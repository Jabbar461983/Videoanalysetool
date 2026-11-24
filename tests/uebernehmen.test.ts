import { describe, expect, it } from 'vitest';
import { hexZuRgb, mittlereFarbe, rgbZuLab, trenneTeams, type Rgb } from '../src/taktik/farben';
import { STANDARD_FELD } from '../src/taktik/feld';
import type { Matrix3 } from '../src/taktik/homographie';
import {
  fussPunkt,
  gruppeFuerTeam1,
  imFeldBereich,
  markerAusErkennungen,
  unterdrueckeDoppelte,
  type BildBox,
} from '../src/taktik/uebernehmen';

describe('Trikotfarben', () => {
  it('Lab: Schwarz < Grau < Weiss in der Helligkeit', () => {
    expect(rgbZuLab([0, 0, 0])[0]).toBeCloseTo(0, 1);
    expect(rgbZuLab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(rgbZuLab([128, 128, 128])[0]).toBeGreaterThan(40);
  });
  it('mittlere Farbe eines Rechtecks, auf das Bild begrenzt', () => {
    const px = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i++) px.set([200, 100, 50, 255], i * 4);
    expect(mittlereFarbe(px, 4, 4, 1, 1, 3, 3)).toEqual([200, 100, 50]);
    expect(mittlereFarbe(px, 4, 4, -5, -5, 99, 99)).toEqual([200, 100, 50]);
    expect(mittlereFarbe(px, 4, 4, 10, 10, 12, 12)).toBeNull();
  });
  it('trennt rote und blaue Trikots in zwei Gruppen', () => {
    const rot: Rgb[] = [
      [200, 30, 30],
      [190, 40, 35],
      [210, 25, 28],
    ];
    const blau: Rgb[] = [
      [30, 40, 190],
      [25, 35, 200],
      [35, 45, 185],
      [28, 38, 195],
    ];
    const r = trenneTeams([...rot, ...blau]);
    expect(new Set(r.zuordnung.slice(0, 3)).size).toBe(1);
    expect(new Set(r.zuordnung.slice(3)).size).toBe(1);
    expect(r.zuordnung[0]).not.toBe(r.zuordnung[3]);
    expect(r.abstand).toBeGreaterThan(40);
  });
  it('sehr ähnliche Farben haben einen kleinen Gruppenabstand; weniger als 2 Farben sind eine Gruppe', () => {
    const r = trenneTeams([
      [100, 100, 100],
      [102, 101, 100],
      [99, 100, 101],
    ]);
    expect(r.abstand).toBeLessThan(5);
    expect(trenneTeams([[1, 2, 3]]).zuordnung).toEqual([0]);
    expect(trenneTeams([]).zuordnung).toEqual([]);
  });
  it('ordnet die Gruppe mit der näheren Teamfarbe Team 1 zu', () => {
    const mitten: [Rgb, Rgb] = [
      [190, 150, 20],
      [20, 110, 90],
    ];
    expect(gruppeFuerTeam1(mitten, '#007057', '#BA990E')).toBe(1);
    expect(gruppeFuerTeam1(mitten, '#BA990E', '#007057')).toBe(0);
    expect(hexZuRgb('#007057')).toEqual([0, 112, 87]);
  });
});

describe('Spielersituation übernehmen', () => {
  // Bild → Feld: einfache Skalierung (Bild 0–1 → 40 × 20 m), keine Perspektive
  const H: Matrix3 = [40, 0, 0, 0, 20, 0, 0, 0, 1];
  const box = (cx: number, cy: number, score = 0.9): BildBox => ({ cx, cy, b: 20, h: 60, score });

  it('Fusspunkt ist die Mitte der Unterkante, normiert', () => {
    expect(fussPunkt(box(960, 500), 1920, 1080)).toEqual({ x: 0.5, y: 530 / 1080 });
  });
  it('Feldbereich mit Toleranz', () => {
    expect(imFeldBereich({ x: -1, y: 10 }, STANDARD_FELD)).toBe(true);
    expect(imFeldBereich({ x: -3, y: 10 }, STANDARD_FELD)).toBe(false);
    expect(imFeldBereich({ x: 20, y: 25 }, STANDARD_FELD)).toBe(false);
  });
  it('Marker nur für Spieler im Feld (Zuschauer fallen heraus), Teams aus der Zuordnung', () => {
    const boxen = [box(960, 500), box(480, 400), box(100, 1400) /* Fuss weit unterhalb des Feldes */];
    const m = markerAusErkennungen(boxen, [0, 1, 0], H, STANDARD_FELD, 1920, 1080);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ art: 'team1' });
    expect(m[0]!.x).toBeCloseTo(20, 4);
    expect(m[1]).toMatchObject({ art: 'team2' });
    expect(new Set(m.map((x) => x.id)).size).toBe(2);
    expect(markerAusErkennungen([box(960, 500)], null, H, STANDARD_FELD, 1920, 1080)[0]!.art).toBe(
      'team1',
    );
  });
  it('doppelte Erkennungen (Kachelränder) werden zusammengefasst', () => {
    const l = unterdrueckeDoppelte([box(100, 100, 0.6), box(102, 101, 0.9), box(500, 100, 0.7)]);
    expect(l).toHaveLength(2);
    expect(l[0]!.score).toBe(0.9);
  });
});
