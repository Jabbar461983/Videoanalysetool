import type { Box } from './tracker';

/** Personendetektor fürs Tracking: RT-DETR v2 (r18vd), Apache-2.0, quantisiert ca. 21 MB. */
export const DETEKTOR_REPO = 'onnx-community/rtdetr_v2_r18vd-ONNX';
export const DETEKTOR_DTYPE = 'q8';
export const DETEKTOR_MB = 21;

/**
 * Quadratischer Ausschnitt (Pixel des Videobilds) um die vorhergesagte Box: ca. 4× Spielerhöhe, mindestens
 * 256 px und höchstens die kleinere Bildseite; wird ins Bild geschoben.
 */
export function ausschnittFuerBox(
  bildB: number,
  bildH: number,
  box: Box,
): { x: number; y: number; seite: number } {
  const maxSeite = Math.min(bildB, bildH);
  const seite = Math.round(Math.min(maxSeite, Math.max(256, box.h * 4, box.b * 6)));
  const x = Math.round(Math.min(Math.max(0, box.cx - seite / 2), bildB - seite));
  const y = Math.round(Math.min(Math.max(0, box.cy - seite / 2), bildH - seite));
  return { x, y, seite };
}
