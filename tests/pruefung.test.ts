import { describe, expect, it } from 'vitest';
import { STANDARD_FELD } from '../src/taktik/feld';
import {
  MAX_SPIELER,
  baueAuswahl,
  markerAusPersonen,
  naechsterZustand,
  tauscheTeams,
  zaehle,
} from '../src/taktik/pruefung';
import type { BildBox } from '../src/taktik/uebernehmen';

const box = (score: number): BildBox => ({ cx: 0, cy: 0, b: 10, h: 30, score });
const feld = STANDARD_FELD;

describe('Auswahl vor der Übernahme', () => {
  it('Personen im Feld sind an, Personen ausserhalb (Zuschauer) aus', () => {
    const r = baueAuswahl(
      [box(0.9), box(0.8), box(0.7)],
      [
        { x: 10, y: 10 },
        { x: 20, y: 21.5 }, // 1.5 m hinter der Bande
        { x: 30, y: 5 },
      ],
      null,
      feld,
    );
    expect(r.personen.map((p) => p.an)).toEqual([true, false, true]);
    expect(r.personen[1]!.grund).toBe('ausserhalb');
    expect(r.ausserhalb).toBe(1);
  });

  it('zwei Personen auf (fast) derselben Stelle: nur die sicherere bleibt', () => {
    const r = baueAuswahl(
      [box(0.6), box(0.9)],
      [
        { x: 10, y: 10 },
        { x: 10.3, y: 10.2 },
      ],
      null,
      feld,
    );
    expect(r.personen.map((p) => p.an)).toEqual([false, true]);
    expect(r.personen[0]!.grund).toBe('doppelt');
    expect(r.doppelt).toBe(1);
  });

  it('mehr als 12 Spieler: die unsichersten werden abgewählt', () => {
    const n = 15;
    const boxen = Array.from({ length: n }, (_, i) => box(0.99 - i * 0.02));
    const pos = Array.from({ length: n }, (_, i) => ({
      x: 2 + (i % 5) * 7,
      y: 2 + Math.floor(i / 5) * 7,
    }));
    const r = baueAuswahl(boxen, pos, null, feld);
    expect(r.personen.filter((p) => p.an)).toHaveLength(MAX_SPIELER);
    expect(r.gekappt).toBe(3);
    // abgewählt sind genau die Personen mit den tiefsten Scores
    expect(r.personen.slice(12).every((p) => !p.an && p.grund === 'zuViele')).toBe(true);
  });

  it('Teams aus der Trikotfarbe; Klick wechselt Team 1 → Team 2 → aus → Team 1', () => {
    const r = baueAuswahl(
      [box(0.9), box(0.8)],
      [
        { x: 5, y: 5 },
        { x: 30, y: 10 },
      ],
      [0, 1],
      feld,
    );
    expect(r.personen.map((p) => p.team)).toEqual([0, 1]);
    let p = r.personen[0]!;
    p = naechsterZustand(p);
    expect([p.an, p.team]).toEqual([true, 1]);
    p = naechsterZustand(p);
    expect(p.an).toBe(false);
    p = naechsterZustand(p);
    expect([p.an, p.team]).toEqual([true, 0]);
  });

  it('Teams tauschen betrifft nur übernommene Personen; Zählung', () => {
    const r = baueAuswahl(
      [box(0.9), box(0.8), box(0.7)],
      [
        { x: 5, y: 5 },
        { x: 30, y: 10 },
        { x: 5, y: 30 },
      ],
      [0, 1, 0],
      feld,
    );
    const t = tauscheTeams(r.personen);
    expect(t.map((p) => p.team)).toEqual([1, 0, 0]); // die dritte ist aus (ausserhalb) und bleibt
    expect(zaehle(t)).toEqual({ team1: 1, team2: 1, aus: 1 });
  });

  it('Marker nur aus übernommenen Personen, im Feld begrenzt', () => {
    const r = baueAuswahl(
      [box(0.9), box(0.8)],
      [
        { x: 5, y: 5 },
        { x: 30.1, y: 20.2 },
      ],
      [0, 1],
      feld,
    );
    const m = markerAusPersonen(r.personen, feld);
    expect(m).toHaveLength(2);
    expect(m[1]).toMatchObject({ art: 'team2' });
    expect(m[1]!.x).toBeLessThanOrEqual(feld.laenge);
    expect(m[1]!.y).toBe(feld.breite);
    const nurEine = markerAusPersonen([{ ...r.personen[0]!, an: false }, r.personen[1]!], feld);
    expect(nurEine).toHaveLength(1);
  });
});
