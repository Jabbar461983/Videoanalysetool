import { describe, expect, it } from 'vitest';
import {
  berechneKalibrierung,
  bewerteKalibrierung,
  invertiere,
  wendeAn,
  type Matrix3,
  type PunktPaar,
} from '../src/taktik/homographie';
import { STANDARD_FELD, bereinigeFeld, referenzPunkte } from '../src/taktik/feld';

// Eine bekannte perspektivische Kamera: Feld (m) → Bild (0–1)
const HFeldBild: Matrix3 = [0.02, 0.004, 0.1, 0, 0.012, 0.35, 0, 0.0009, 1];
const abbilden = (feld: { x: number; y: number }) => wendeAn(HFeldBild, feld)!;

const punkte = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 20 },
  { x: 0, y: 20 },
  { x: 20, y: 10 },
  { x: 10, y: 5 },
];
const paare = (n: number, rausch = 0): PunktPaar[] =>
  punkte.slice(0, n).map((f, i) => {
    const b = abbilden(f);
    return { feld: f, bild: { x: b.x + (i % 2 ? rausch : -rausch), y: b.y } };
  });

describe('Homographie', () => {
  it('invertiert und wendet an', () => {
    const inv = invertiere(HFeldBild)!;
    const p = wendeAn(inv, abbilden({ x: 13, y: 7 }))!;
    expect(p.x).toBeCloseTo(13, 6);
    expect(p.y).toBeCloseTo(7, 6);
    expect(invertiere([1, 2, 3, 2, 4, 6, 1, 1, 1])).toBeNull();
  });

  it('findet die Abbildung Bild → Feld aus 4 Punkten exakt', () => {
    const k = berechneKalibrierung(paare(4))!;
    expect(k.rms).toBeNull(); // bei 4 Punkten keine Kontrolle möglich
    const feld = wendeAn(k.H, abbilden({ x: 27, y: 13 }))!;
    expect(feld.x).toBeCloseTo(27, 4);
    expect(feld.y).toBeCloseTo(13, 4);
    expect(bewerteKalibrierung(k, 44.7)).toBe('ungeprueft');
  });

  it('zeigt bei mehr Punkten den Fehler an: exakt = gut, verrauscht = grösserer Fehler', () => {
    const exakt = berechneKalibrierung(paare(6))!;
    expect(exakt.rms!).toBeLessThan(1e-6);
    expect(bewerteKalibrierung(exakt, 44.7)).toBe('gut');
    const rauschig = berechneKalibrierung(paare(6, 0.01))!;
    expect(rauschig.rms!).toBeGreaterThan(0.05);
    expect(rauschig.maxFehler!).toBeGreaterThanOrEqual(rauschig.rms!);
  });

  it('weist entartete Punkte ab (drei auf einer Linie, zu wenige)', () => {
    const linie: PunktPaar[] = [0, 1, 2, 3].map((i) => ({
      feld: { x: i * 10, y: 0 },
      bild: { x: 0.1 * i, y: 0.5 },
    }));
    expect(berechneKalibrierung(linie)).toBeNull();
    expect(berechneKalibrierung(paare(3))).toBeNull();
    // drei Punkte auf einer Linie + ein vierter: nicht eindeutig lösbar
    const dreiPlusEins: PunktPaar[] = [
      { feld: { x: 0, y: 0 }, bild: { x: 0.1, y: 0.5 } },
      { feld: { x: 10, y: 0 }, bild: { x: 0.2, y: 0.5 } },
      { feld: { x: 20, y: 0 }, bild: { x: 0.3, y: 0.5 } },
      { feld: { x: 10, y: 10 }, bild: { x: 0.2, y: 0.8 } },
    ];
    expect(berechneKalibrierung(dreiPlusEins)).toBeNull();
  });
});

describe('Feld', () => {
  it('Referenzpunkte liegen im Feld und haben eindeutige Ids', () => {
    const r = referenzPunkte(STANDARD_FELD);
    expect(new Set(r.map((p) => p.id)).size).toBe(r.length);
    for (const p of r) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(STANDARD_FELD.laenge);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(STANDARD_FELD.breite);
    }
  });
  it('begrenzt unsinnige Eingaben', () => {
    const f = bereinigeFeld({ ...STANDARD_FELD, laenge: -5, breite: NaN, eckenradius: 999 });
    expect(f.laenge).toBe(10);
    expect(f.breite).toBe(5);
    expect(f.eckenradius).toBeLessThanOrEqual(2.5);
    expect(STANDARD_FELD.geprueft).toBe(false);
  });
});

describe('Plausibilität der Kalibrierung', () => {
  it('eine echte Kamera-Abbildung ist plausibel', async () => {
    const { pruefePlausibilitaet, invertiere: inv } = await import('../src/taktik/homographie');
    const HBildFeld = inv(HFeldBild)!;
    expect(pruefePlausibilitaet(HBildFeld, 40, 20)).toEqual({ ok: true });
  });
  it('vertauschte Punkte (verdrehtes Viereck) werden erkannt', async () => {
    const { pruefePlausibilitaet } = await import('../src/taktik/homographie');
    // Feldpunkte der vier Ecken, aber zwei Bildpunkte vertauscht
    const p = (f: [number, number], b: [number, number]): PunktPaar => ({
      feld: { x: f[0], y: f[1] },
      bild: { x: b[0], y: b[1] },
    });
    const gut = [
      p([0, 0], [0.3, 0.3]),
      p([40, 0], [0.7, 0.3]),
      p([40, 20], [0.9, 0.8]),
      p([0, 20], [0.1, 0.8]),
    ];
    const verdreht = [gut[0]!, gut[2]!, gut[1]!, gut[3]!].map((x, i) => ({
      feld: gut[i]!.feld,
      bild: x.bild,
    }));
    const k1 = berechneKalibrierung(gut)!;
    const k2 = berechneKalibrierung(verdreht);
    expect(pruefePlausibilitaet(k1.H, 40, 20)).toEqual({ ok: true });
    if (k2) expect(pruefePlausibilitaet(k2.H, 40, 20).ok).toBe(false);
  });
});
