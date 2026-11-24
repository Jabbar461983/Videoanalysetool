import { describe, expect, it } from 'vitest';
import type { Clip } from '../src/model/typen';
import { migriere, neuesProjekt } from '../src/model/schema';
import {
  abschnittBei,
  animationsAnteil,
  dupliziereSituation,
  fuegeAbschnittHinzu,
  neueSituation,
  neuerMarker,
  schalteTafelBei,
} from '../src/taktik/logik';
import { tafelInhaltBei } from '../src/render/tafelOverlay';

const clip = (): Clip => ({
  id: 'c',
  quelleId: 'q',
  in: 0,
  out: 20,
  name: 'Clip',
  freezeFrames: [],
  zeitlupen: [],
});

describe('Tafel-Abschnitte', () => {
  it('Hotkey T: erst einblenden (ab t, höchstens bis zum Clipende), dann ausblenden', () => {
    const c = clip();
    expect(schalteTafelBei(c, 4, 20)).toBe('hinzugefuegt');
    expect(c.taktik!.abschnitte).toMatchObject([{ start: 4, ende: 12 }]);
    expect(abschnittBei(c, 5)).toBeTruthy();
    expect(abschnittBei(c, 12.5)).toBeUndefined();
    expect(schalteTafelBei(c, 5, 20)).toBe('entfernt');
    expect(c.taktik!.abschnitte).toHaveLength(0);
    expect(schalteTafelBei(c, 18, 20)).toBe('hinzugefuegt');
    expect(c.taktik!.abschnitte[0]!.ende).toBe(20);
  });
  it('überlappende Abschnitte werden gekürzt oder aufgeteilt', () => {
    const c = clip();
    fuegeAbschnittHinzu(c, 0, 10);
    fuegeAbschnittHinzu(c, 4, 6);
    expect(c.taktik!.abschnitte.map((a) => [a.start, a.ende])).toEqual([
      [0, 4],
      [4, 6],
      [6, 10],
    ]);
    expect(fuegeAbschnittHinzu(c, 1, 1.1)).toBeNull();
  });
  it('Animationsanteil: läuft in den ersten 80 %, danach Ziel', () => {
    const a = { start: 10, ende: 20 };
    expect(animationsAnteil(a, 10)).toBe(0);
    expect(animationsAnteil(a, 14)).toBeCloseTo(0.5);
    expect(animationsAnteil(a, 18)).toBe(1);
    expect(animationsAnteil(a, 19.9)).toBe(1);
  });
});

describe('Situationen und Tafel-Inhalt', () => {
  it('Kopie behält die Marker-Ids (für die Animation), bekommt aber eigene Situations- und Pfeil-Ids', () => {
    const s = neueSituation(
      'A',
      [neuerMarker('team1', 5, 5, 7)],
      [{ id: 'p1', art: 'pass', von: { x: 1, y: 1 }, nach: { x: 2, y: 2 } }],
    );
    const k = dupliziereSituation(s);
    expect(k.id).not.toBe(s.id);
    expect(k.marker[0]!.id).toBe(s.marker[0]!.id);
    expect(k.pfeile[0]!.id).not.toBe('p1');
    expect(k.name).toBe('A (Kopie)');
  });
  it('liefert die gewählte Situation, mischt bei Animation, zeigt sonst ein leeres Feld', () => {
    const p = neuesProjekt('T');
    const a = neueSituation('A', [{ id: 'm', art: 'team1', x: 0, y: 0 }]);
    const b = neueSituation('B', [{ id: 'm', art: 'team1', x: 20, y: 0 }]);
    p.taktik.situationen.push(a, b);
    const c = clip();
    fuegeAbschnittHinzu(c, 0, 10, a.id, b.id);
    expect(tafelInhaltBei(p, c, 0)!.marker[0]!.x).toBeCloseTo(0);
    expect(tafelInhaltBei(p, c, 4)!.marker[0]!.x).toBeCloseTo(10, 0);
    expect(tafelInhaltBei(p, c, 9)!.marker[0]!.x).toBeCloseTo(20);
    expect(tafelInhaltBei(p, c, 11)).toBeNull();
    const leer = clip();
    fuegeAbschnittHinzu(leer, 0, 5);
    expect(tafelInhaltBei(p, leer, 1)).toEqual({ marker: [], pfeile: [] });
  });
});

describe('Migration auf Version 8', () => {
  it('ergänzt die Feldmasse (Platzhalter) und leert die alten Taktik-Platzhalter', () => {
    const m = migriere({
      version: 7,
      taktik: { feld: { x: 1 }, kalibrierungen: [1], situationen: [2], anzeige: [] },
      quellen: [],
      teams: [],
      clips: [],
      einstellungen: {},
    });
    expect(m.taktik.feld.laenge).toBe(40);
    expect(m.taktik.feld.geprueft).toBe(false);
    expect(m.taktik.kalibrierungen).toEqual([]);
    expect(m.taktik.situationen).toEqual([]);
    expect(m.taktik.aktiveKalibrierung).toEqual({});
  });
});
