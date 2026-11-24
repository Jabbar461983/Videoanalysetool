import { describe, expect, it } from 'vitest';
import { STANDARD_FELD } from '../src/taktik/feld';
import {
  mischeSituationen,
  tafelAbbildung,
  tafelRechteck,
  tafelSeitenverhaeltnis,
} from '../src/taktik/tafel';
import type { Situation } from '../src/model/typen';

const feld = STANDARD_FELD;
const sit = (id: string, marker: Situation['marker']): Situation => ({
  id,
  name: id,
  marker,
  pfeile: [],
  erstelltAm: 0,
});

describe('Tafel-Layout', () => {
  it('Bild-im-Bild: Ecke, Breite, Abstand, Seitenverhältnis', () => {
    const r = tafelRechteck({ modus: 'pip', ecke: 'ur', groesse: 0.3 }, 1920, 1080, feld);
    expect(r.b).toBe(576);
    expect(r.h).toBe(Math.round(576 / tafelSeitenverhaeltnis(feld)));
    expect(r.x + r.b).toBe(1920 - 48);
    expect(r.y + r.h).toBe(1080 - 48);
    const ol = tafelRechteck({ modus: 'pip', ecke: 'ol', groesse: 0.3 }, 1920, 1080, feld);
    expect(ol.x).toBe(48);
    expect(ol.y).toBe(48);
  });
  it('geteilt = rechte 42 %, Vollbild = ganzes Bild; Grösse wird begrenzt', () => {
    expect(tafelRechteck({ modus: 'geteilt', ecke: 'ur', groesse: 0.3 }, 1000, 500, feld)).toEqual({
      x: 580,
      y: 0,
      b: 420,
      h: 500,
    });
    expect(tafelRechteck({ modus: 'voll', ecke: 'ur', groesse: 0.3 }, 1000, 500, feld)).toEqual({
      x: 0,
      y: 0,
      b: 1000,
      h: 500,
    });
    expect(tafelRechteck({ modus: 'pip', ecke: 'ur', groesse: 5 }, 1000, 500, feld).b).toBe(600);
  });
  it('Abbildung Meter ↔ Pixel ist umkehrbar und zentriert das Feld', () => {
    const r = { x: 100, y: 50, b: 440, h: 220 };
    const m = tafelAbbildung(feld, r);
    const p = m.px(10, 5);
    const z = m.meter(p.x, p.y);
    expect(z.x).toBeCloseTo(10, 9);
    expect(z.y).toBeCloseTo(5, 9);
    const mitte = m.px(feld.laenge / 2, feld.breite / 2);
    expect(mitte.x).toBeCloseTo(r.x + r.b / 2, 6);
    expect(mitte.y).toBeCloseTo(r.y + r.h / 2, 6);
  });
});

describe('Animation zwischen Situationen', () => {
  const a = sit('a', [
    { id: 'm1', art: 'team1', x: 0, y: 0, nummer: 7 },
    { id: 'm2', art: 'team2', x: 10, y: 10 },
  ]);
  const b = sit('b', [
    { id: 'm1', art: 'team1', x: 20, y: 10, nummer: 7 },
    { id: 'm3', art: 'ball', x: 5, y: 5 },
  ]);
  it('Start und Ende entsprechen den Situationen, dazwischen gleiten die Marker', () => {
    const start = mischeSituationen(a, b, 0);
    expect(start.marker.find((m) => m.id === 'm1')).toMatchObject({ x: 0, y: 0 });
    const ende = mischeSituationen(a, b, 1);
    expect(ende.marker.find((m) => m.id === 'm1')).toMatchObject({ x: 20, y: 10 });
    const halb = mischeSituationen(a, b, 0.5);
    expect(halb.marker.find((m) => m.id === 'm1')!.x).toBeCloseTo(10, 6);
  });
  it('Marker, die nur in einer Situation vorkommen, blenden aus bzw. ein', () => {
    const halb = mischeSituationen(a, b, 0.5);
    expect(halb.markerAlpha!.m2).toBeCloseTo(0.5, 6);
    expect(halb.markerAlpha!.m3).toBeCloseTo(0.5, 6);
    expect(mischeSituationen(a, b, 1).markerAlpha!.m2).toBe(0);
    expect(mischeSituationen(a, b, 0).markerAlpha!.m3).toBe(0);
    expect(mischeSituationen(a, b, -3).marker.length).toBe(3); // Wert wird begrenzt
  });
});
