import type { Projekt } from '../model/typen';

/**
 * Ziel eines Render-Durchgangs. In der Vorschau ist es das Overlay-Canvas,
 * im Export (ab Etappe 6) ein OffscreenCanvas im Worker.
 */
export interface RenderZiel {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  breite: number;
  hoehe: number;
  modus: 'vorschau' | 'export';
}

/**
 * Die EINE Compositing-Funktion für Vorschau und Export (CLAUDE.md Grundsatz 2).
 * `t` = Quellzeit in Sekunden. Etappe 0: zeichnet bewusst nichts, räumt aber auf.
 * Spätere Etappen ergänzen hier Zeichnungen, Overlays, Titelfolien usw.
 */
export function renderFrame(_t: number, _projekt: Projekt | null, ziel: RenderZiel): void {
  ziel.ctx.clearRect(0, 0, ziel.breite, ziel.hoehe);
}
