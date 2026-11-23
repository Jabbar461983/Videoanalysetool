import { describe, expect, it } from 'vitest';
import { erweitereMaske, fuelleRingweise } from '../src/ki/fuellen';

describe('Hintergrund füllen', () => {
  it('erweitert die Maske um r Pixel', () => {
    const m = new Uint8Array(100);
    m[5 * 10 + 5] = 255;
    const e = erweitereMaske(m, 10, 10, 2);
    expect(e[3 * 10 + 3]).toBe(255);
    expect(e[7 * 10 + 7]).toBe(255);
    expect(e[2 * 10 + 5]).toBe(0);
    expect(erweitereMaske(m, 10, 10, 0)).toEqual(m);
  });
  it('füllt ein Loch in einer einfarbigen Fläche mit derselben Farbe', () => {
    const b = 20;
    const h = 20;
    const rgba = new Uint8ClampedArray(b * h * 4);
    for (let i = 0; i < b * h; i++) rgba.set([30, 120, 40, 255], i * 4);
    const maske = new Uint8Array(b * h);
    for (let y = 6; y < 14; y++)
      for (let x = 6; x < 14; x++) {
        maske[y * b + x] = 255;
        rgba.set([255, 0, 0, 255], (y * b + x) * 4);
      }
    fuelleRingweise(rgba, b, h, maske);
    const i = (10 * b + 10) * 4;
    expect(Math.abs(rgba[i]! - 30)).toBeLessThan(2);
    expect(Math.abs(rgba[i + 1]! - 120)).toBeLessThan(2);
    expect(Math.abs(rgba[i + 2]! - 40)).toBeLessThan(2);
  });
  it('lässt Bilder ohne oder mit vollständiger Maske unverändert', () => {
    const rgba = new Uint8ClampedArray(16).fill(7);
    fuelleRingweise(rgba, 2, 2, new Uint8Array(4));
    fuelleRingweise(rgba, 2, 2, new Uint8Array(4).fill(255));
    expect([...rgba].every((v) => v === 7)).toBe(true);
  });
});
