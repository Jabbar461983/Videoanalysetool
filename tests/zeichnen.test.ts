import { SCHEMA_VERSION } from '../src/model/typen';
import { describe, expect, it } from 'vitest';
import {
  abstandPfad,
  glaetten,
  griffIndizes,
  imPolygon,
  laenge,
  pfad,
  schalteGebogen,
  setzePunkt,
  teilPfad,
  trifft,
  vereinfache,
  verschiebe,
} from '../src/zeichnen/geometrie';
import {
  abgleichZeitachse,
  ebene,
  kopiereZeichnung,
  mitZeichnungsAbgleich,
  naechsteNummer,
  neueZeichnung,
  standardZeitspanne,
} from '../src/zeichnen/logik';
import { zustandZu } from '../src/render/zeichnungen';
import {
  beende,
  ignoriereBeginn,
  neuerPalmZustand,
  nimmAn,
  STIFT_SPERRFENSTER_MS,
  vermerkeStift,
} from '../src/zeichnen/palm';
import { clipSegmente } from '../src/wiedergabe/zeitachse';
import { neuesProjekt, migriere } from '../src/model/schema';
import { entferneClip, dupliziereClip, trimmeClipImProjekt } from '../src/schnitt/schnittLogik';
import { STANDARD_STIL } from '../src/zeichnen/geometrie';
import type { Clip, Projekt, Zeichnung } from '../src/model/typen';

const W = 1920;
const H = 1080;
const clip = (o: Partial<Clip> = {}): Clip => ({
  id: 'c',
  quelleId: 'q',
  in: 10,
  out: 20,
  name: 'c',
  freezeFrames: [],
  zeitlupen: [],
  ...o,
});
const zeich = (o: Partial<Zeichnung> = {}): Zeichnung => ({
  ...neueZeichnung(
    'pfeil',
    'c',
    [
      { x: 0.2, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ],
    STANDARD_STIL,
    { start: 1, ende: 4 },
  ),
  ...o,
});

describe('Geometrie', () => {
  it('Pfad, Länge und Teilpfad (zeichnet sich)', () => {
    const z = zeich();
    const p = pfad(z, W, H);
    expect(p).toHaveLength(2);
    expect(laenge(p)).toBeCloseTo(0.4 * W);
    const t = teilPfad(p, 0.5);
    expect(laenge(t)).toBeCloseTo(0.2 * W);
    expect(teilPfad(p, 1)).toBe(p);
    expect(laenge(teilPfad(p, 0))).toBe(0);
  });
  it('gebogener Pfeil hat Steuerpunkt; Umschalten gerade ↔ gebogen', () => {
    const z = zeich();
    const g = schalteGebogen(z, W, H);
    expect(g.punkte).toHaveLength(3);
    expect(pfad(g, W, H).length).toBe(33);
    expect(laenge(pfad(g, W, H))).toBeGreaterThan(laenge(pfad(z, W, H)));
    expect(schalteGebogen(g, W, H).punkte).toHaveLength(2);
  });
  it('Ellipse: Mittelpunkt + zwei Halbachsen, geschlossen', () => {
    const z = neueZeichnung(
      'kreis',
      'c',
      [
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.5 },
        { x: 0.5, y: 0.55 },
      ],
      STANDARD_STIL,
      { start: 0, ende: 1 },
    );
    const p = pfad(z, W, H);
    expect(p[0]!.x).toBeCloseTo(0.6 * W);
    expect(p[0]!.y).toBeCloseTo(0.5 * H);
    expect(p[p.length - 1]!.x).toBeCloseTo(p[0]!.x);
    expect(p[18]!.y).toBeCloseTo(0.55 * H); // Viertel: Richtung v
  });
  it('Treffertests: Linie nah/fern, Zone innen, Marker, Text', () => {
    const l = zeich();
    expect(trifft(l, { x: 0.4 * W, y: 0.5 * H + 4 }, W, H, 10)).toBe(true);
    expect(trifft(l, { x: 0.4 * W, y: 0.5 * H + 60 }, W, H, 10)).toBe(false);
    const zone = neueZeichnung(
      'zone',
      'c',
      [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.6, y: 0.6 },
        { x: 0.2, y: 0.6 },
      ],
      STANDARD_STIL,
      { start: 0, ende: 1 },
    );
    expect(trifft(zone, { x: 0.4 * W, y: 0.4 * H }, W, H, 8)).toBe(true);
    expect(trifft(zone, { x: 0.8 * W, y: 0.4 * H }, W, H, 8)).toBe(false);
    const m = neueZeichnung(
      'marker',
      'c',
      [{ x: 0.5, y: 0.5 }],
      STANDARD_STIL,
      { start: 0, ende: 1 },
      { nummer: 7 },
    );
    expect(trifft(m, { x: 0.5 * W + 20, y: 0.5 * H }, W, H, 8)).toBe(true);
    const tx = neueZeichnung(
      'text',
      'c',
      [{ x: 0.1, y: 0.1 }],
      STANDARD_STIL,
      { start: 0, ende: 1 },
      { text: 'Hallo' },
    );
    expect(trifft(tx, { x: 0.1 * W + 30, y: 0.1 * H + 20 }, W, H, 8)).toBe(true);
    expect(trifft(tx, { x: 0.9 * W, y: 0.9 * H }, W, H, 8)).toBe(false);
  });
  it('Griffe, Verschieben, Punkt setzen (Ellipsenmitte zieht Achsen mit)', () => {
    const z = zeich();
    expect(griffIndizes(z)).toEqual([0, 1]);
    expect(verschiebe(z, 0.1, -0.1).punkte[0]!.x).toBeCloseTo(0.3);
    expect(setzePunkt(z, 1, { x: 0.9, y: 0.9 }).punkte[1]).toMatchObject({ x: 0.9, y: 0.9 });
    const k = neueZeichnung(
      'kreis',
      'c',
      [
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.5 },
        { x: 0.5, y: 0.55 },
      ],
      STANDARD_STIL,
      { start: 0, ende: 1 },
    );
    const k2 = setzePunkt(k, 0, { x: 0.3, y: 0.3 });
    expect(k2.punkte[1]!.x).toBeCloseTo(0.4);
    expect(k2.punkte[2]!.y).toBeCloseTo(0.35);
    expect(griffIndizes({ ...z, werkzeug: 'freihand' })).toEqual([]);
  });
  it('vereinfacht und glättet Freihand', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: i * 4, y: Math.sin(i / 8) * 0.2 }));
    const keep = vereinfache(pts, 1);
    expect(keep.length).toBeLessThan(pts.length);
    expect(keep[0]).toBe(0);
    expect(keep[keep.length - 1]).toBe(49);
    expect(glaetten(pts.slice(0, 6)).length).toBeGreaterThan(6);
    expect(glaetten(pts.slice(0, 2))).toHaveLength(2);
  });
  it('Punkt im Polygon, Abstand zum Pfad', () => {
    const q = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(imPolygon({ x: 5, y: 5 }, q)).toBe(true);
    expect(imPolygon({ x: 15, y: 5 }, q)).toBe(false);
    expect(
      abstandPfad({ x: 5, y: 3 }, [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe(3);
  });
});

describe('Animation', () => {
  it('Einblenden, Ausblenden, zeichnet sich', () => {
    const z = zeich({
      animation: { ein: 'einblenden', dauerEin: 1, aus: 'ausblenden', dauerAus: 1 },
      start: 2,
      ende: 8,
    });
    expect(zustandZu(z, 1.9)).toBeNull();
    expect(zustandZu(z, 8)).toBeNull();
    expect(zustandZu(z, 2)!.alpha).toBeCloseTo(0);
    expect(zustandZu(z, 2.5)!.alpha).toBeCloseTo(0.5);
    expect(zustandZu(z, 5)!.alpha).toBe(1);
    expect(zustandZu(z, 7.5)!.alpha).toBeCloseTo(0.5);
    const w = zeich({
      animation: { ein: 'zeichnen', dauerEin: 2, aus: 'keine', dauerAus: 0 },
      start: 0,
      ende: 5,
    });
    expect(zustandZu(w, 1)).toMatchObject({ alpha: 1, aufbau: 0.5 });
    expect(zustandZu(w, 3)!.aufbau).toBe(1);
  });
});

describe('Standard-Animation', () => {
  it('Neue Zeichnungen erscheinen sofort; «zeichnet sich» nur für Linienwerkzeuge', () => {
    const z = neueZeichnung(
      'pfeil',
      'c',
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      STANDARD_STIL,
      { start: 0, ende: 1 },
    );
    expect(z.animation).toMatchObject({ ein: 'keine', aus: 'keine' });
    const a = {
      ein: 'zeichnen' as const,
      dauerEin: 0.8,
      aus: 'ausblenden' as const,
      dauerAus: 0.3,
    };
    expect(
      neueZeichnung('pfeil', 'c', [{ x: 0, y: 0 }], STANDARD_STIL, { start: 0, ende: 1 }, {}, a)
        .animation.ein,
    ).toBe('zeichnen');
    expect(
      neueZeichnung('zone', 'c', [{ x: 0, y: 0 }], STANDARD_STIL, { start: 0, ende: 1 }, {}, a)
        .animation.ein,
    ).toBe('einblenden');
    expect(
      neueZeichnung('marker', 'c', [{ x: 0, y: 0 }], STANDARD_STIL, { start: 0, ende: 1 }, {}, a)
        .animation.dauerEin,
    ).toBeLessThanOrEqual(0.5);
  });
});

describe('Zeitspanne, Ebenen, Kopie, Nummer', () => {
  it('Standard: 3 s oder bis Ende des Standbilds, begrenzt auf die Clipdauer', () => {
    const c = clip({ freezeFrames: [{ zeit: 14, dauer: 3 }] });
    const segs = clipSegmente(c); // 0–4 Video, 4–7 Freeze, 7–13 Video
    expect(standardZeitspanne(segs, 1)).toEqual({ start: 1, ende: 4 });
    expect(standardZeitspanne(segs, 5)).toEqual({ start: 5, ende: 7 });
    expect(standardZeitspanne(segs, 12)).toEqual({ start: 12, ende: 13 });
  });
  it('Ebenenreihenfolge', () => {
    const p = neuesProjekt('x');
    const [a, b, c] = [zeich(), zeich(), zeich()];
    p.zeichnungen.push(a, b, c);
    ebene(p, a.id, 'vorn');
    expect(p.zeichnungen.map((z) => z.id)).toEqual([b.id, c.id, a.id]);
    ebene(p, a.id, 'tiefer');
    expect(p.zeichnungen.map((z) => z.id)).toEqual([b.id, a.id, c.id]);
    ebene(p, c.id, 'hinten');
    expect(p.zeichnungen[0]!.id).toBe(c.id);
  });
  it('Kopie bekommt neue Id und Versatz; Marker-Nummern zählen hoch', () => {
    const z = zeich();
    const k = kopiereZeichnung(z, 5, 13);
    expect(k.id).not.toBe(z.id);
    expect([k.start, k.ende]).toEqual([5, 8]);
    expect(k.punkte[0]!.x).toBeCloseTo(0.22);
    const p = neuesProjekt('x');
    expect(naechsteNummer(p, 'c')).toBe(1);
    p.zeichnungen.push(
      neueZeichnung(
        'marker',
        'c',
        [{ x: 0, y: 0 }],
        STANDARD_STIL,
        { start: 0, ende: 1 },
        { nummer: 3 },
      ),
    );
    expect(naechsteNummer(p, 'c')).toBe(4);
    expect(naechsteNummer(p, 'andere')).toBe(1);
  });
});

describe('Zeitabgleich bei Änderungen am Clip', () => {
  it('Standbild vor einer Zeichnung schiebt sie nach hinten (gleiches Videobild)', () => {
    const alt = clip();
    const neu = clip({ freezeFrames: [{ zeit: 12, dauer: 3 }] });
    const z = zeich({ start: 5, ende: 8 }); // Quellzeit 15–18
    const [r] = abgleichZeitachse(alt, neu, [z]);
    expect([r!.start, r!.ende]).toEqual([8, 11]);
  });
  it('Zeichnung im Standbild bleibt im Standbild; Zeichnung vor dem Standbild bleibt', () => {
    const alt = clip({ freezeFrames: [{ zeit: 14, dauer: 3 }] }); // Freeze 4–7
    const neu = clip({
      freezeFrames: [{ zeit: 14, dauer: 3 }],
      zeitlupen: [{ von: 11, bis: 12, tempo: 0.5 }],
    });
    const im = zeich({ start: 4.5, ende: 6.5 });
    const vor = zeich({ start: 0, ende: 2 });
    const [a, b] = abgleichZeitachse(alt, neu, [im, vor]);
    expect([a!.start, a!.ende]).toEqual([5.5, 7.5]); // +1 s durch die Zeitlupe davor
    expect([b!.start, b!.ende]).toEqual([0, 3]); // 0–2 s Quelle, davon 1 s in Zeitlupe
  });
  it('Trimmen am Anfang verschiebt die Clipzeit; Ausserhalb liegende Zeichnungen verschwinden', () => {
    const p: Projekt = neuesProjekt('x');
    const c = clip();
    p.clips.push(c);
    p.zeichnungen.push(zeich({ start: 1, ende: 3 }), zeich({ start: 6, ende: 9 }));
    const ok = trimmeClipImProjekt(p, 'c', 'in', 14, { dauer: 100, fps: 25 });
    expect(ok).toBe(true);
    expect(p.zeichnungen).toHaveLength(1);
    expect([p.zeichnungen[0]!.start, p.zeichnungen[0]!.ende]).toEqual([2, 5]);
  });
  it('mitZeichnungsAbgleich erhält die Ebenenreihenfolge über Clips hinweg', () => {
    const p = neuesProjekt('x');
    p.clips.push(clip(), clip({ id: 'd' }));
    const a = zeich({ clipId: 'c' });
    const b = zeich({ clipId: 'd' });
    const c2 = zeich({ clipId: 'c' });
    p.zeichnungen.push(a, b, c2);
    mitZeichnungsAbgleich(p, 'c', (cl) => {
      cl.freezeFrames.push({ zeit: 10, dauer: 1 });
    });
    expect(p.zeichnungen.map((z) => z.id)).toEqual([a.id, b.id, c2.id]);
    expect(p.zeichnungen[0]!.start).toBe(2);
  });
  it('Clip löschen/duplizieren nimmt die Zeichnungen mit', () => {
    const p = neuesProjekt('x');
    p.clips.push(clip());
    p.zeichnungen.push(zeich());
    const id = dupliziereClip(p, 'c')!;
    expect(p.zeichnungen.map((z) => z.clipId)).toEqual(['c', id]);
    entferneClip(p, 'c');
    expect(p.zeichnungen.map((z) => z.clipId)).toEqual([id]);
  });
});

describe('Handballen-Erkennung', () => {
  it('ignoriert Touch kurz nach Stift und zweite Finger, nimmt einen Finger an', () => {
    const z = neuerPalmZustand();
    const touch = { pointerType: 'touch', pointerId: 5 };
    const pen = { pointerType: 'pen', pointerId: 1 };
    expect(ignoriereBeginn(touch, z, 0)).toBe(false);
    vermerkeStift(pen, z, 1000);
    expect(ignoriereBeginn(touch, z, 1000 + STIFT_SPERRFENSTER_MS - 1)).toBe(true);
    expect(ignoriereBeginn(touch, z, 1000 + STIFT_SPERRFENSTER_MS + 1)).toBe(false);
    expect(ignoriereBeginn(pen, z, 1100)).toBe(false);
    expect(ignoriereBeginn({ pointerType: 'mouse', pointerId: 1 }, z, 1100)).toBe(false);
    nimmAn(touch, z);
    expect(ignoriereBeginn({ pointerType: 'touch', pointerId: 6 }, z, 9999)).toBe(true);
    beende(touch, z);
    expect(ignoriereBeginn({ pointerType: 'touch', pointerId: 6 }, z, 9999)).toBe(false);
  });
});

describe('Migration auf Version 4', () => {
  it('ergänzt Einstellung und leert alte Zeichnungsplatzhalter', () => {
    const p = neuesProjekt('alt') as unknown as Record<string, unknown>;
    p.version = 3;
    p.einstellungen = { trackingModus: 'auto', exportAufloesung: 1080 };
    p.zeichnungen = [{ id: 'x', quelleId: 'q', start: 0, ende: 1 }];
    const m = migriere(p);
    expect(m.version).toBe(SCHEMA_VERSION);
    expect(m.einstellungen.zeichnenAnhalten).toBe(true);
    expect(m.zeichnungen).toEqual([]);
  });
});
