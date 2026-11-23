/** Reine Bildfunktionen zum Füllen der Lücke, die ein verschobener Spieler hinterlässt (kein OpenCV nötig). */

/** Maske (0/255) um `r` Pixel vergrössern (quadratisches Element, getrennt in x und y). */
export function erweitereMaske(maske: Uint8Array, b: number, h: number, r: number): Uint8Array {
  if (r <= 0) return maske.slice();
  const zw = new Uint8Array(maske.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      let an = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(b - 1, x + r); k++) {
        if (maske[y * b + k]) {
          an = 255;
          break;
        }
      }
      zw[y * b + x] = an;
    }
  }
  const aus = new Uint8Array(maske.length);
  for (let x = 0; x < b; x++) {
    for (let y = 0; y < h; y++) {
      let an = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
        if (zw[k * b + x]) {
          an = 255;
          break;
        }
      }
      aus[y * b + x] = an;
    }
  }
  return aus;
}

/**
 * Füllt die Maskenpixel ringweise von aussen nach innen mit dem Mittel der bekannten Nachbarn
 * (8er-Nachbarschaft) und glättet danach. Einfach, schnell, ohne Abhängigkeiten; dient als
 * Ausweichlösung, wenn OpenCV.js nicht geladen werden kann.
 * `rgba` (b×h×4) wird direkt verändert.
 */
export function fuelleRingweise(
  rgba: Uint8ClampedArray,
  b: number,
  h: number,
  maske: Uint8Array,
): void {
  const unbekannt = new Uint8Array(maske.length);
  let offen = 0;
  for (let i = 0; i < maske.length; i++) {
    if (maske[i]) {
      unbekannt[i] = 1;
      offen++;
    }
  }
  if (offen === 0 || offen === maske.length) return;
  while (offen > 0) {
    const jetzt: number[] = [];
    const farben: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < b; x++) {
        const i = y * b + x;
        if (!unbekannt[i]) continue;
        let n = 0;
        let r = 0;
        let g = 0;
        let bl = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= b || yy >= h) continue;
            const j = yy * b + xx;
            if (unbekannt[j]) continue;
            n++;
            r += rgba[j * 4]!;
            g += rgba[j * 4 + 1]!;
            bl += rgba[j * 4 + 2]!;
          }
        }
        if (n > 0) {
          jetzt.push(i);
          farben.push(r / n, g / n, bl / n);
        }
      }
    }
    if (jetzt.length === 0) break;
    jetzt.forEach((i, k) => {
      rgba[i * 4] = farben[k * 3]!;
      rgba[i * 4 + 1] = farben[k * 3 + 1]!;
      rgba[i * 4 + 2] = farben[k * 3 + 2]!;
      rgba[i * 4 + 3] = 255;
      unbekannt[i] = 0;
    });
    offen -= jetzt.length;
  }
  // Glätten nur der gefüllten Pixel (2 Durchgänge, 3×3-Mittel)
  for (let durchgang = 0; durchgang < 2; durchgang++) {
    const kopie = rgba.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < b - 1; x++) {
        const i = y * b + x;
        if (!maske[i]) continue;
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) s += kopie[((y + dy) * b + x + dx) * 4 + c]!;
          rgba[i * 4 + c] = s / 9;
        }
      }
    }
  }
}
