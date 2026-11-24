import { describe, expect, it } from 'vitest';
import { STANDARD_FELD } from '../src/taktik/feld';
import { berechneKalibrierung, wendeAn } from '../src/taktik/homographie';
import {
  feldEcken,
  findeBoden,
  ordneEcken,
  schaetzeEcken,
  schlageFeldVor,
  type BildDaten,
} from '../src/taktik/feldVorschlag';

const W = 320;
const H = 180;
// Boden-Viereck im Bild (Pixel), Perspektive: oben schmaler
const ECKEN = [
  { x: 70, y: 50 },
  { x: 250, y: 50 },
  { x: 305, y: 160 },
  { x: 15, y: 160 },
];

function inViereck(x: number, y: number): boolean {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < 4; i++) {
    const a = ECKEN[i]!;
    const b = ECKEN[(i + 1) % 4]!;
    const k = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (k > 0) pos++;
    else neg++;
  }
  return pos === 4 || neg === 4;
}

function bild(): BildDaten {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let c = [120, 120, 125]; // graue Umgebung
      if (inViereck(x, y)) c = [40, 90, 190]; // blauer Boden
      if (inViereck(x, y) && (Math.abs(x - 160) < 2 || Math.abs(y - 105) < 2)) c = [220, 220, 220]; // Linien
      if (inViereck(x, y) && Math.hypot(x - 120, y - 100) < 8) c = [30, 30, 30]; // Spieler
      data.set([...c, 255], i);
    }
  return { data, width: W, height: H };
}

describe('Feldvorschlag', () => {
  it('findet den Boden', () => {
    const b = findeBoden(bild());
    expect(b).not.toBeNull();
    expect(b!.flaeche).toBeGreaterThan(0.3);
  });

  it('schätzt die vier Ecken auf wenige Pixel genau', () => {
    const b = findeBoden(bild())!;
    const e = ordneEcken(schaetzeEcken(b.maske, W, H)!);
    e.forEach((p, i) => {
      expect(Math.hypot(p.x - ECKEN[i]!.x, p.y - ECKEN[i]!.y)).toBeLessThan(6);
    });
  });

  it('schlägt Referenzpunkte vor, die zur wahren Abbildung passen', () => {
    const v = schlageFeldVor(bild(), STANDARD_FELD)!;
    expect(v).not.toBeNull();
    const mitte = v.punkte.find((p) => p.id === 'mitte')!;
    const echt = berechneKalibrierung(
      ECKEN.map((p, i) => ({
        bild: { x: p.x / W, y: p.y / H },
        feld: feldEcken(STANDARD_FELD, { tauscheX: false, tauscheY: false, quer: false })[i]!,
      })),
    )!;
    expect(echt).not.toBeNull();
    const m = wendeAn(v.H, mitte.bild)!;
    expect(m.x).toBeCloseTo(STANDARD_FELD.laenge / 2, 0);
    expect(m.y).toBeCloseTo(STANDARD_FELD.breite / 2, 0);
  });

  it('Ausrichtung tauscht Seiten', () => {
    const a = feldEcken(STANDARD_FELD, { tauscheX: false, tauscheY: false, quer: false });
    const b = feldEcken(STANDARD_FELD, { tauscheX: true, tauscheY: false, quer: false });
    expect(b[0]!.x).toBe(a[1]!.x);
    const q = feldEcken(STANDARD_FELD, { tauscheX: false, tauscheY: false, quer: true });
    expect(q[0]).toEqual(a[1]);
  });

  it('liefert null ohne farbigen Boden', () => {
    const d = new Uint8ClampedArray(W * H * 4).fill(128);
    expect(schlageFeldVor({ data: d, width: W, height: H }, STANDARD_FELD)).toBeNull();
  });
});
