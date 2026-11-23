import type { Projekt } from '../model/typen';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { blendeAlpha, findeSegmentIndex, type Zeitplan } from '../wiedergabe/zeitachse';
import { zeichneTitelfolie } from './titelfolie';

export type RenderKontext =
  { art: 'quelle' } | { art: 'clip'; clipId: string } | { art: 'playlist'; playlistId: string };

/**
 * Ziel eines Render-Durchgangs. In der Vorschau ist es das Overlay-Canvas,
 * im Export (ab Etappe 6) ein OffscreenCanvas im Worker.
 */
export interface RenderZiel {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  breite: number;
  hoehe: number;
  modus: 'vorschau' | 'export';
  /** Bedeutung von `t`: Quellzeit (Standard), Clip-Zeit oder Playlist-Zeit. */
  kontext?: RenderKontext;
}

const planCache = new WeakMap<Projekt, Map<string, Zeitplan | null>>();
function holePlan(projekt: Projekt, k: Exclude<RenderKontext, { art: 'quelle' }>): Zeitplan | null {
  let m = planCache.get(projekt);
  if (!m) planCache.set(projekt, (m = new Map()));
  const key = k.art === 'clip' ? `c:${k.clipId}` : `p:${k.playlistId}`;
  if (!m.has(key)) {
    m.set(
      key,
      baueProgrammPlan(
        projekt,
        k.art,
        k.art === 'clip' ? k.clipId : undefined,
        k.art === 'playlist' ? k.playlistId : undefined,
      ),
    );
  }
  return m.get(key) ?? null;
}

/**
 * Die EINE Compositing-Funktion für Vorschau und Export (CLAUDE.md Grundsatz 2).
 * Etappe 2: Titelfolien und Blenden. Das Video selbst liegt in der Vorschau darunter;
 * der Export (Etappe 6) zeichnet zuerst das decodierte Bild und ruft dann diese Funktion.
 * Spätere Etappen ergänzen Zeichnungen, Overlays usw. an derselben Stelle.
 */
export function renderFrame(t: number, projekt: Projekt | null, ziel: RenderZiel): void {
  const { ctx, breite, hoehe } = ziel;
  ctx.clearRect(0, 0, breite, hoehe);
  const k = ziel.kontext;
  if (!projekt || !k || k.art === 'quelle') return;
  const plan = holePlan(projekt, k);
  if (!plan || plan.segmente.length === 0) return;
  const seg = plan.segmente[findeSegmentIndex(plan.segmente, t)];
  if (seg?.art === 'titel' && seg.titel) zeichneTitelfolie(ctx, breite, hoehe, seg.titel);
  const alpha = blendeAlpha(plan, t);
  if (alpha > 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.restore();
  }
}
