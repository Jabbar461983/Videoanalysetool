import { describe, expect, it } from 'vitest';
import {
  ausschnittRahmen,
  bereinigeMaske,
  maskenFlaeche,
  maskenIoU,
  maskenRahmen,
} from '../src/ki/ausschnitt';
import { holeModell, SAM_MODELLE, STANDARD_SAM } from '../src/ki/modelle';

describe('Ausschnitt um den Klick', () => {
  it('quadratisch, im Bild, Kantenlänge 0.3 der Breite (mind. 256)', () => {
    expect(ausschnittRahmen(1920, 1080, 960, 540)).toEqual({ x: 672, y: 252, b: 576, h: 576 });
    const rand = ausschnittRahmen(1920, 1080, 10, 1070);
    expect(rand).toEqual({ x: 0, y: 504, b: 576, h: 576 });
    expect(ausschnittRahmen(400, 300, 200, 150).b).toBe(256);
    expect(ausschnittRahmen(100, 80, 50, 40).b).toBe(80); // nie grösser als das Bild
  });
});

describe('Masken', () => {
  const m = (breite: number, hoehe: number, rechtecke: [number, number, number, number][]) => {
    const a = new Uint8Array(breite * hoehe);
    for (const [x0, y0, x1, y1] of rechtecke)
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * breite + x] = 255;
    return a;
  };
  it('Rahmen, Fläche, IoU', () => {
    const a = m(20, 20, [[5, 5, 10, 15]]);
    expect(maskenRahmen(a, 20, 20)).toEqual({ x: 5, y: 5, b: 5, h: 10 });
    expect(maskenRahmen(new Uint8Array(400), 20, 20)).toBeNull();
    expect(maskenFlaeche(a)).toBe(50);
    expect(maskenIoU(a, a)).toBe(1);
    expect(maskenIoU(a, m(20, 20, [[10, 5, 15, 15]]))).toBe(0);
    expect(maskenIoU(a, m(20, 20, [[5, 5, 10, 10]]))).toBeCloseTo(0.5);
  });
  it('Bereinigen: nur die Fläche am Klick bleibt, Löcher werden gefüllt', () => {
    const a = m(30, 20, [
      [2, 2, 12, 18],
      [20, 5, 24, 9],
    ]); // Hauptfläche + Fehlpixelgruppe
    a[10 * 30 + 6] = 0; // Loch
    const b = bereinigeMaske(a, 30, 20, 5, 5);
    expect(b[5 * 30 + 21]).toBe(0); // Insel entfernt
    expect(b[10 * 30 + 6]).toBe(255); // Loch gefüllt
    expect(maskenFlaeche(b)).toBe(10 * 16);
    // Klick daneben → grösste Fläche
    const c = bereinigeMaske(a, 30, 20, 28, 15);
    expect(c[5 * 30 + 21]).toBe(0);
    expect(maskenFlaeche(c)).toBe(10 * 16);
    expect(bereinigeMaske(new Uint8Array(100), 10, 10, 1, 1)).toHaveLength(100);
  });
});

describe('Modellliste', () => {
  it('alle Modelle sind Apache-2.0, Standard existiert, unbekannte IDs fallen auf das erste zurück', () => {
    expect(SAM_MODELLE.length).toBeGreaterThanOrEqual(3);
    expect(SAM_MODELLE.every((x) => x.lizenz === 'Apache-2.0')).toBe(true);
    expect(holeModell(STANDARD_SAM).id).toBe(STANDARD_SAM);
    expect(holeModell('gibtsnicht').id).toBe(SAM_MODELLE[0]!.id);
  });
});
