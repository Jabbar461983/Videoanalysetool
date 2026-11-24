import { describe, expect, it } from 'vitest';
import { neuesProjekt } from '../src/model/schema';
import type { Projekt, Quelle } from '../src/model/typen';
import {
  baueAutoEintraege,
  findeTreffer,
  fuelleAutomatisch,
  leereAuswahl,
} from '../src/schnitt/autoPlaylist';
import { fuegeTagHinzu } from '../src/tagging/tagLogik';

function projekt(): Projekt {
  const p = neuesProjekt('Test');
  const q = (id: string): Quelle =>
    ({
      id,
      dateiname: id,
      groesse: 1,
      teilHash: 'x',
      dauer: 600,
      fps: 25,
      breite: 1920,
      hoehe: 1080,
      codec: 'avc',
    }) as Quelle;
  p.quellen.push(q('h1'), q('h2'));
  return p;
}
const defTor = (p: Projekt) => p.tagDefinitionen.find((d) => d.istTor)!;
const defX = (p: Projekt) => p.tagDefinitionen.find((d) => !d.istTor)!;

function mitTags() {
  const p = projekt();
  const sp = p.teams[0]!.kader;
  sp.push({ id: 's17', nummer: 17, name: 'Meier', position: 'stuermer' });
  const add = (def: ReturnType<typeof defTor>, qi: number, zeit: number, spieler?: string) => {
    const id = fuegeTagHinzu(p, def, p.quellen[qi]!, zeit);
    const t = p.tags.find((x) => x.id === id)!;
    t.teamId = p.teams[0]!.id;
    if (spieler) t.spielerId = spieler;
  };
  add(defTor(p), 1, 30, 's17'); // 2. Halbzeit
  add(defTor(p), 0, 100);
  add(defX(p), 0, 50, 's17');
  add(defX(p), 0, 10);
  return p;
}

describe('Automatische Playlist', () => {
  it('findet Treffer chronologisch über mehrere Videos', () => {
    const p = mitTags();
    const t = findeTreffer(p, { ...leereAuswahl(), defIds: [defTor(p).id] });
    expect(t.map((x) => [x.tag.quelleId, x.tag.zeit])).toEqual([
      ['h1', 100],
      ['h2', 30],
    ]);
  });

  it('zweiter Filter: Spieler (und Video)', () => {
    const p = mitTags();
    expect(findeTreffer(p, { ...leereAuswahl(), spielerId: 's17' })).toHaveLength(2);
    expect(findeTreffer(p, { ...leereAuswahl(), spielerId: 's17', quelleId: 'h1' })).toHaveLength(
      1,
    );
  });

  it('Gruppieren fügt vor jedem Thema eine Titelfolie ein', () => {
    const p = mitTags();
    const e = baueAutoEintraege(p, leereAuswahl(), { gruppieren: true });
    expect(e.map((x) => x.typ)).toEqual(['titel', 'clip', 'clip', 'titel', 'clip', 'clip']);
    const titel = e.filter((x) => x.typ === 'titel');
    expect(titel[0]).toMatchObject({ untertitel: '2 Szenen' });
  });

  it('ohne Gruppieren: nur Clips, abgewählte fehlen', () => {
    const p = mitTags();
    const alle = findeTreffer(p, leereAuswahl());
    const e = baueAutoEintraege(
      p,
      { ...leereAuswahl(), ausgeschlossen: [alle[0]!.tag.id] },
      { gruppieren: false },
    );
    expect(e).toHaveLength(alle.length - 1);
    expect(e.every((x) => x.typ === 'clip')).toBe(true);
  });

  it('hängt am Ende an, ohne Dubletten und ohne leere Gruppen', () => {
    const p = mitTags();
    const r1 = fuelleAutomatisch(
      p,
      { name: 'Tore' },
      { ...leereAuswahl(), defIds: [defTor(p).id] },
      { gruppieren: true },
    )!;
    expect(r1.szenen).toBe(2);
    const pl = p.playlisten.find((x) => x.id === r1.playlistId)!;
    expect(pl.eintraege).toHaveLength(3);
    const r2 = fuelleAutomatisch(p, pl.id, leereAuswahl(), { gruppieren: true })!;
    expect(r2.szenen).toBe(2); // nur die 2 Nicht-Tor-Szenen sind neu
    expect(pl.eintraege).toHaveLength(3 + 3);
    expect(pl.eintraege[0]!.typ).toBe('titel'); // bestehender Anfang bleibt
    const r3 = fuelleAutomatisch(p, pl.id, leereAuswahl(), { gruppieren: true })!;
    expect(r3.szenen).toBe(0);
    expect(pl.eintraege).toHaveLength(6);
  });
});
