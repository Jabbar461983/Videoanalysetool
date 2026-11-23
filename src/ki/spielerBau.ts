import type { NormRahmen } from '../model/typen';
import { maskenRahmen, type Rahmen } from './ausschnitt';
import { fuelleHintergrund } from './inpaint';

/** Zeichenfläche im Hauptthread. */
export function neueFlaeche(b: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Aktuelles Videobild in voller Videoauflösung. */
export function frameVonVideo(v: HTMLVideoElement): HTMLCanvasElement | null {
  if (!v.videoWidth || !v.videoHeight) return null;
  const c = neueFlaeche(v.videoWidth, v.videoHeight);
  c.getContext('2d')!.drawImage(v, 0, 0);
  return c;
}

/** Weichzeichnung (3×3-Mittel) eines Alpha-Kanals, damit die Kante nicht treppig wirkt. */
export function glaetteAlpha(a: Float32Array, b: number, h: number, durchgaenge = 1): Float32Array {
  let quelle = a;
  for (let n = 0; n < durchgaenge; n++) {
    const ziel = new Float32Array(a.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < b; x++) {
        let s = 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= b || yy >= h) continue;
            s += quelle[yy * b + xx]!;
            k++;
          }
        }
        ziel[y * b + x] = s / k;
      }
    }
    quelle = ziel;
  }
  return quelle;
}

export interface GebauterKeyframe {
  box: NormRahmen;
  boxPx: Rahmen;
  bild: string;
  ausschnitt: string;
  lupeBox: NormRahmen;
  fuss: { x: number; y: number };
  /** Maske in Box-Koordinaten (0/255) */
  boxMaske: Uint8Array;
}

const norm = (r: Rahmen, W: number, H: number): NormRahmen => ({
  x: r.x / W,
  y: r.y / H,
  b: r.b / W,
  h: r.h / H,
});

/**
 * Aus einer SAM-Maske (in `crop` = Ausschnitt des Bildes, Grösse mb×mh) den Keyframe-Inhalt bauen:
 * freigestellter Spieler als PNG (weiche Kante), Umgebungsausschnitt für die Lupe, Rahmen und Fusspunkt.
 */
export function baueKeyframe(
  frame: HTMLCanvasElement,
  maske: Uint8Array,
  crop: Rahmen,
  mb: number,
  mh: number,
  rand = 6,
): GebauterKeyframe | null {
  const W = frame.width;
  const H = frame.height;
  const mr = maskenRahmen(maske, mb, mh);
  if (!mr) return null;
  const sx = crop.b / mb;
  const sy = crop.h / mh;
  const x0 = Math.max(0, Math.floor(crop.x + mr.x * sx - rand));
  const y0 = Math.max(0, Math.floor(crop.y + mr.y * sy - rand));
  const x1 = Math.min(W, Math.ceil(crop.x + (mr.x + mr.b) * sx + rand));
  const y1 = Math.min(H, Math.ceil(crop.y + (mr.y + mr.h) * sy + rand));
  const boxPx: Rahmen = { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  if (boxPx.b < 2 || boxPx.h < 2) return null;

  const boxMaske = new Uint8Array(boxPx.b * boxPx.h);
  for (let y = 0; y < boxPx.h; y++) {
    for (let x = 0; x < boxPx.b; x++) {
      const mx = Math.floor((x0 + x - crop.x) / sx);
      const my = Math.floor((y0 + y - crop.y) / sy);
      if (mx >= 0 && my >= 0 && mx < mb && my < mh && maske[my * mb + mx])
        boxMaske[y * boxPx.b + x] = 255;
    }
  }
  const alpha = glaetteAlpha(
    Float32Array.from(boxMaske, (v) => v / 255),
    boxPx.b,
    boxPx.h,
  );
  const daten = frame.getContext('2d')!.getImageData(x0, y0, boxPx.b, boxPx.h);
  for (let i = 0; i < alpha.length; i++) daten.data[i * 4 + 3] = Math.round(alpha[i]! * 255);
  const c = neueFlaeche(boxPx.b, boxPx.h);
  c.getContext('2d')!.putImageData(daten, 0, 0);
  const bild = c.toDataURL('image/png');

  // Lupe: Umgebung 1.7× der Box, mindestens 160 px, im Bild
  const lb = Math.min(W, Math.max(160, boxPx.b * 1.7));
  const lh = Math.min(H, Math.max(160, boxPx.h * 1.7));
  const lx = Math.min(Math.max(0, boxPx.x + boxPx.b / 2 - lb / 2), W - lb);
  const ly = Math.min(Math.max(0, boxPx.y + boxPx.h / 2 - lh / 2), H - lh);
  const lupePx: Rahmen = {
    x: Math.round(lx),
    y: Math.round(ly),
    b: Math.round(lb),
    h: Math.round(lh),
  };
  const lc = neueFlaeche(lupePx.b, lupePx.h);
  lc.getContext('2d')!.drawImage(
    frame,
    lupePx.x,
    lupePx.y,
    lupePx.b,
    lupePx.h,
    0,
    0,
    lupePx.b,
    lupePx.h,
  );
  const ausschnitt = lc.toDataURL('image/jpeg', 0.85);

  return {
    box: norm(boxPx, W, H),
    boxPx,
    bild,
    ausschnitt,
    lupeBox: norm(lupePx, W, H),
    fuss: { x: (boxPx.x + boxPx.b / 2) / W, y: (boxPx.y + boxPx.h) / H },
    boxMaske,
  };
}

/** Maske (0/255) aus dem Alpha-Kanal des freigestellten Spielers. */
export async function maskeAusBild(bildDaten: string, b: number, h: number): Promise<Uint8Array> {
  const bm = await createImageBitmap(await (await fetch(bildDaten)).blob());
  const c = neueFlaeche(b, h);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bm, 0, 0, b, h);
  bm.close();
  const d = ctx.getImageData(0, 0, b, h).data;
  const m = new Uint8Array(b * h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3]! > 24 ? 255 : 0;
  return m;
}

/**
 * Hintergrund für die Fläche `boxPx` ohne den Spieler (`boxMaske`): Der Inpainting-Bereich ist die Box
 * samt 24 px Umgebung, damit der Füllalgorithmus Farbe und Linien aus der Nachbarschaft kennt.
 */
export async function baueHintergrund(
  frame: HTMLCanvasElement,
  boxPx: Rahmen,
  boxMaske: Uint8Array,
): Promise<{ daten: string; verfahren: string }> {
  const W = frame.width;
  const H = frame.height;
  const pad = 24;
  const rx = Math.max(0, boxPx.x - pad);
  const ry = Math.max(0, boxPx.y - pad);
  const rb = Math.min(W, boxPx.x + boxPx.b + pad) - rx;
  const rh = Math.min(H, boxPx.y + boxPx.h + pad) - ry;
  const bild = frame.getContext('2d')!.getImageData(rx, ry, rb, rh);
  const m = new Uint8Array(rb * rh);
  for (let y = 0; y < boxPx.h; y++) {
    for (let x = 0; x < boxPx.b; x++) {
      if (boxMaske[y * boxPx.b + x]) m[(boxPx.y - ry + y) * rb + (boxPx.x - rx + x)] = 255;
    }
  }
  const { bild: gefuellt, verfahren } = await fuelleHintergrund(bild, m);
  const c = neueFlaeche(rb, rh);
  c.getContext('2d')!.putImageData(gefuellt, 0, 0);
  const o = neueFlaeche(boxPx.b, boxPx.h);
  o.getContext('2d')!.drawImage(
    c,
    boxPx.x - rx,
    boxPx.y - ry,
    boxPx.b,
    boxPx.h,
    0,
    0,
    boxPx.b,
    boxPx.h,
  );
  return { daten: o.toDataURL('image/png'), verfahren };
}
