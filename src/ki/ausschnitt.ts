/** Hilfen für die Segmentierung kleiner Objekte: Ausschnitt um den Klick und Maskenverarbeitung (rein, ohne Browser). */

export interface Rahmen {
  x: number;
  y: number;
  b: number;
  h: number;
}

/**
 * Quadratischer Ausschnitt um den Klick `(cx, cy)` (Pixel). Kantenlänge = `anteil` der Bildbreite (mindestens 256,
 * höchstens die kleinere Bildseite). Der Ausschnitt wird ins Bild geschoben, nie verkleinert.
 */
export function ausschnittRahmen(
  bildB: number,
  bildH: number,
  cx: number,
  cy: number,
  anteil = 0.3,
): Rahmen {
  const kante = Math.round(Math.min(Math.min(bildB, bildH), Math.max(256, bildB * anteil)));
  const x = Math.round(Math.min(Math.max(0, cx - kante / 2), bildB - kante));
  const y = Math.round(Math.min(Math.max(0, cy - kante / 2), bildH - kante));
  return { x, y, b: kante, h: kante };
}

/** Umschliessender Rahmen der gesetzten Pixel (Wert > 0) einer Maske; `null`, wenn leer. */
export function maskenRahmen(maske: Uint8Array, breite: number, hoehe: number): Rahmen | null {
  let x0 = breite;
  let y0 = hoehe;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      if (maske[y * breite + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, b: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const maskenFlaeche = (maske: Uint8Array): number => {
  let n = 0;
  for (const v of maske) if (v) n++;
  return n;
};

/** Überlappung zweier Masken gleicher Grösse (Schnittmenge / Vereinigung), 0–1. */
export function maskenIoU(a: Uint8Array, b: Uint8Array): number {
  let i = 0;
  let u = 0;
  const n = Math.min(a.length, b.length);
  for (let k = 0; k < n; k++) {
    const x = a[k] !== 0;
    const y = b[k] !== 0;
    if (x && y) i++;
    if (x || y) u++;
  }
  return u === 0 ? 0 : i / u;
}

/**
 * Behält nur die zusammenhängende Fläche, die den Klickpunkt enthält (oder, falls er daneben liegt, die grösste),
 * und füllt kleine Löcher. Entfernt versprengte Fehlpixel von SAM.
 */
export function bereinigeMaske(
  maske: Uint8Array,
  breite: number,
  hoehe: number,
  px: number,
  py: number,
): Uint8Array {
  const label = new Int32Array(maske.length);
  const groessen: number[] = [0];
  let n = 0;
  const stapel: number[] = [];
  for (let s = 0; s < maske.length; s++) {
    if (!maske[s] || label[s]) continue;
    n++;
    let g = 0;
    stapel.push(s);
    label[s] = n;
    while (stapel.length) {
      const p = stapel.pop()!;
      g++;
      const x = p % breite;
      const y = (p / breite) | 0;
      if (x > 0 && maske[p - 1] && !label[p - 1]) {
        label[p - 1] = n;
        stapel.push(p - 1);
      }
      if (x < breite - 1 && maske[p + 1] && !label[p + 1]) {
        label[p + 1] = n;
        stapel.push(p + 1);
      }
      if (y > 0 && maske[p - breite] && !label[p - breite]) {
        label[p - breite] = n;
        stapel.push(p - breite);
      }
      if (y < hoehe - 1 && maske[p + breite] && !label[p + breite]) {
        label[p + breite] = n;
        stapel.push(p + breite);
      }
    }
    groessen[n] = g;
  }
  if (n === 0) return maske;
  const kx = Math.min(breite - 1, Math.max(0, Math.round(px)));
  const ky = Math.min(hoehe - 1, Math.max(0, Math.round(py)));
  let behalten = label[ky * breite + kx] ?? 0;
  if (!behalten) behalten = groessen.indexOf(Math.max(...groessen.slice(1)));
  const aus = new Uint8Array(maske.length);
  for (let i = 0; i < maske.length; i++) if (label[i] === behalten) aus[i] = 255;
  // Löcher füllen: Hintergrund, der nicht mit dem Rand verbunden ist
  const aussen = new Uint8Array(maske.length);
  for (let x = 0; x < breite; x++) {
    for (const y of [0, hoehe - 1]) {
      const p = y * breite + x;
      if (!aus[p] && !aussen[p]) {
        aussen[p] = 1;
        stapel.push(p);
      }
    }
  }
  for (let y = 0; y < hoehe; y++) {
    for (const x of [0, breite - 1]) {
      const p = y * breite + x;
      if (!aus[p] && !aussen[p]) {
        aussen[p] = 1;
        stapel.push(p);
      }
    }
  }
  while (stapel.length) {
    const p = stapel.pop()!;
    const x = p % breite;
    const y = (p / breite) | 0;
    for (const q of [
      x > 0 ? p - 1 : -1,
      x < breite - 1 ? p + 1 : -1,
      y > 0 ? p - breite : -1,
      y < hoehe - 1 ? p + breite : -1,
    ]) {
      if (q >= 0 && !aus[q] && !aussen[q]) {
        aussen[q] = 1;
        stapel.push(q);
      }
    }
  }
  for (let i = 0; i < aus.length; i++) if (!aus[i] && !aussen[i]) aus[i] = 255;
  return aus;
}
