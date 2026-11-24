/** Trikotfarben: Mittelwert aus dem Oberkörper und Aufteilung in zwei Mannschaften (k-means, k = 2 in Lab). */
export type Rgb = [number, number, number];
export type Lab = [number, number, number];

export function rgbZuLab([r, g, b]: Rgb): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

const abstand = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Mittlere Farbe der RGBA-Pixel in einem Rechteck des Bildes (Pixelkoordinaten, wird auf das Bild begrenzt). */
export function mittlereFarbe(
  rgba: Uint8ClampedArray | Uint8Array,
  breite: number,
  hoehe: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Rgb | null {
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(breite, Math.ceil(x1));
  const yb = Math.min(hoehe, Math.ceil(y1));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * breite + x) * 4;
      r += rgba[i]!;
      g += rgba[i + 1]!;
      b += rgba[i + 2]!;
      n++;
    }
  }
  return n === 0 ? null : [r / n, g / n, b / n];
}

/**
 * Teilt Farben in zwei Gruppen (0/1). Start: die beiden am weitesten entfernten Farben.
 * Gibt zusätzlich die Mittelpunkte und den Abstand der Gruppen (Lab) zurück – ein kleiner Abstand heisst «nicht trennbar».
 */
export function trenneTeams(farben: Rgb[]): {
  zuordnung: number[];
  mitten: [Rgb, Rgb] | null;
  abstand: number;
} {
  if (farben.length < 2) return { zuordnung: farben.map(() => 0), mitten: null, abstand: 0 };
  const lab = farben.map(rgbZuLab);
  let ia = 0;
  let ib = 1;
  let best = -1;
  for (let i = 0; i < lab.length; i++)
    for (let j = i + 1; j < lab.length; j++) {
      const d = abstand(lab[i]!, lab[j]!);
      if (d > best) {
        best = d;
        ia = i;
        ib = j;
      }
    }
  let c: [Lab, Lab] = [lab[ia]!, lab[ib]!];
  let z = lab.map(() => 0);
  for (let it = 0; it < 20; it++) {
    z = lab.map((p) => (abstand(p, c[0]) <= abstand(p, c[1]) ? 0 : 1));
    const neu = [0, 1].map((k) => {
      const m = lab.filter((_, i) => z[i] === k);
      if (m.length === 0) return c[k]!;
      return [0, 1, 2].map((a) => m.reduce((s, p) => s + p[a]!, 0) / m.length) as Lab;
    });
    const gleich =
      neu[0]!.every((v, a) => Math.abs(v - c[0][a]!) < 1e-6) &&
      neu[1]!.every((v, a) => Math.abs(v - c[1][a]!) < 1e-6);
    c = [neu[0]!, neu[1]!];
    if (gleich) break;
  }
  const mittelRgb = (k: number): Rgb => {
    const m = farben.filter((_, i) => z[i] === k);
    if (m.length === 0) return farben[0]!;
    return [0, 1, 2].map((a) => m.reduce((s, p) => s + p[a]!, 0) / m.length) as Rgb;
  };
  return { zuordnung: z, mitten: [mittelRgb(0), mittelRgb(1)], abstand: abstand(c[0], c[1]) };
}

/** Rgb zu Hex (für Vergleiche mit Teamfarben). */
export function hexZuRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
