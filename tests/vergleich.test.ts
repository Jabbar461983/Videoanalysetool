import { describe, expect, it } from 'vitest';
import { migriere } from '../src/model/schema';
import { SCHEMA_VERSION, type Clip, type PlaylistEintrag } from '../src/model/typen';
import { entferneClip, neuerVergleich } from '../src/schnitt/schnittLogik';
import { neuesProjekt } from '../src/model/schema';
import {
  playlistZeitplan,
  segmenteDauer,
  vergleichSeitenZeit,
  vergleichSegmente,
} from '../src/wiedergabe/zeitachse';

const clip = (
  id: string,
  quelle: string,
  a: number,
  b: number,
  extra: Partial<Clip> = {},
): Clip => ({
  id,
  quelleId: quelle,
  in: a,
  out: b,
  name: id,
  freezeFrames: [],
  zeitlupen: [],
  ...extra,
});
type Vergleich = Extract<PlaylistEintrag, { typ: 'vergleich' }>;
const vergleich = (o: Partial<Vergleich> = {}): Vergleich => ({
  ...(neuerVergleich('A', 'B') as Vergleich),
  ...o,
});

describe('Vergleich: Zeitplan', () => {
  const A = clip('A', 'q1', 10, 14); // 4 s
  const B = clip('B', 'q2', 100, 106); // 6 s

  it('nacheinander: links läuft, Pause, rechts läuft (rechts/links abgedunkelt), Zugabe', () => {
    const segs = vergleichSegmente(vergleich({ zugabe: false, pause: 1, abdunklung: 0.5 }), A, B);
    expect(segs.map((s) => [s.dauer, s.vergleich!.aktiv])).toEqual([
      [4, 'links'],
      [1, null],
      [6, 'rechts'],
    ]);
    const [l, p, r] = segs.map((s) => s.vergleich!);
    // Links läuft: rechts steht abgedunkelt auf der Ausgangslage (Clip-Anfang)
    expect(l!.links).toMatchObject({ laeuft: true, von: 10, bis: 14, dim: 0 });
    expect(l!.rechts).toMatchObject({ laeuft: false, zeit: 100, dim: 0.5 });
    // Pause: links dunkel auf letztem Bild, rechts hell auf Ausgangslage
    expect(p!.links).toMatchObject({ laeuft: false, zeit: 14, dim: 0.5 });
    expect(p!.rechts).toMatchObject({ laeuft: false, zeit: 100, dim: 0 });
    // Rechts läuft: links bleibt dunkel auf dem letzten Bild
    expect(r!.rechts).toMatchObject({ laeuft: true, von: 100, bis: 106, dim: 0 });
    expect(r!.links).toMatchObject({ laeuft: false, zeit: 14, dim: 0.5 });
    expect(segmenteDauer(segs)).toBe(11);
  });

  it('Zugabe: am Ende laufen beide gleichzeitig (Dauer = längere Seite) nach einer Pause', () => {
    const segs = vergleichSegmente(vergleich({ zugabe: true, pause: 1 }), A, B);
    const ende = segs.slice(3);
    expect(ende[0]!.vergleich!.aktiv).toBeNull(); // Pause, beide hell
    expect(ende[0]!.vergleich!.links.dim).toBe(0);
    const beide = ende.slice(1);
    expect(beide[0]!.vergleich!.aktiv).toBe('beide');
    expect(beide.reduce((s, x) => s + x.dauer, 0)).toBeCloseTo(6);
    // Nach 4 s steht links am Ende, rechts läuft allein
    expect(beide[beide.length - 1]!.vergleich!.aktiv).toBe('rechts');
    expect(beide[beide.length - 1]!.vergleich!.links).toMatchObject({ laeuft: false, zeit: 14 });
  });

  it('gleichzeitig: Anker fallen zusammen', () => {
    // Anker links bei 1 s, rechts bei 3 s → links startet 2 s später
    const e = vergleich({
      ablauf: 'gleichzeitig',
      links: { ...vergleich().links, anker: 1 },
      rechts: { ...vergleich().rechts, anker: 3 },
    });
    const segs = vergleichSegmente(e, A, B);
    expect(segmenteDauer(segs)).toBeCloseTo(6); // max(2+4, 0+6)
    expect(segs[0]!.vergleich!.links).toMatchObject({ laeuft: false, zeit: 10 }); // wartet am Clip-Anfang
    expect(segs[0]!.vergleich!.rechts.laeuft).toBe(true);
    // Zur Zeit 3 s (Anker rechts, Clip-Zeit 3) ist links bei Clip-Zeit 1
    const t3 = segs.find((s) => s.start <= 3 && s.start + s.dauer > 3)!;
    expect(vergleichSeitenZeit(t3, 'links', 3)).toBeCloseTo(11);
    expect(vergleichSeitenZeit(t3, 'rechts', 3)).toBeCloseTo(103);
  });

  it('berücksichtigt Zeitlupe und Standbild im Clip', () => {
    const C = clip('A', 'q1', 0, 4, {
      freezeFrames: [{ zeit: 2, dauer: 3 }],
      zeitlupen: [{ von: 0, bis: 1, tempo: 0.5 }],
    });
    const segs = vergleichSegmente(vergleich({ zugabe: false, pause: 0 }), C, B);
    const links = segs.filter((s) => s.vergleich!.aktiv === 'links');
    expect(links.reduce((s, x) => s + x.dauer, 0)).toBeCloseTo(8); // 0–1 s in 2 s, 1–2 s, Standbild 3 s, 2–4 s
    expect(links.some((s) => !s.vergleich!.links.laeuft && s.vergleich!.links.zeit === 2)).toBe(
      true,
    );
  });

  it('Playlist: Eintrag erscheint im Zeitplan, fehlende Clips werden übersprungen', () => {
    const pl = {
      eintraege: [
        vergleich({ zugabe: false }),
        vergleich({ links: { ...vergleich().links, clipId: 'X' } }),
      ],
    };
    const plan = playlistZeitplan(pl, [A, B]);
    expect(plan.eintraege).toHaveLength(1);
    expect(plan.dauer).toBeCloseTo(11);
    expect(plan.segmente.every((s) => s.art === 'vergleich')).toBe(true);
  });

  it('Löschen eines Clips entfernt Vergleiche, die ihn nutzen', () => {
    const p = neuesProjekt('T');
    p.clips.push(A, B);
    p.playlisten.push({ id: 'p', name: 'p', eintraege: [vergleich()] });
    entferneClip(p, 'A');
    expect(p.playlisten[0]!.eintraege).toHaveLength(0);
  });

  it('Schema: alte Projekte (v9) lassen sich öffnen', () => {
    const p = neuesProjekt('T');
    const alt = { ...p, version: 9 };
    expect(migriere(alt).version).toBe(SCHEMA_VERSION);
  });
});
