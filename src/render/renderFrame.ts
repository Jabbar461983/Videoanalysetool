import type { Projekt } from '../model/typen';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { blendeAlpha, findeSegmentIndex, type Zeitplan } from '../wiedergabe/zeitachse';
import { zeichneTitelfolie } from './titelfolie';
import { zeichneSpielerObjekte, type BilderMap } from './spieler';
import { zeichneClipZeichnungen, zeichneZeichnung } from './zeichnungen';
import type { Zeichnung } from '../model/typen';
import { ausblendenVon, istAusgeblendet } from '../overlay/ausblenden';
import { spielstand } from '../overlay/spielstand';
import { clipZeitZuQuellZeit } from '../wiedergabe/zeitachse';
import type { LogoBild } from './logo';
import { zeichneLogo, zeichneScoreboard } from './overlays';

export type RenderKontext =
  | { art: 'quelle'; quelleId?: string }
  | { art: 'clip'; clipId: string }
  | { art: 'playlist'; playlistId: string };

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
  /** Nur Vorschau: Entwürfe/gerade verschobene Zeichnungen (Clip-Zeit = `t`). */
  zusatz?: Zeichnung[];
  /** Logo-Bild (Vorschau: Lader; Export: Bitmap im Worker). Fehlt es, wird kein Logo gezeichnet. */
  logo?: LogoBild | null;
  /** Nur Vorschau: Zeichnungen, die gerade durch `zusatz` ersetzt werden. */
  ausblenden?: ReadonlySet<string>;
  /** Dekodierte Bilder der Spieler-Objekte (Vorschau: Lader in der Bühne; Export: Worker) */
  bilder?: BilderMap;
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
  if (!projekt || !k) return;
  const einst = projekt.einstellungen;
  const logoZeichnen = (logoHier: boolean) => {
    if (logoHier && einst.logoAnzeigen && ziel.logo)
      zeichneLogo(ctx, breite, ziel.logo, einst.logoGroesse);
  };
  const stand = (quelleId: string, quellZeit: number) => {
    if (einst.scoreboardAnzeigen)
      zeichneScoreboard(ctx, breite, projekt.teams, spielstand(projekt, quelleId, quellZeit));
  };

  // Quell-Ansicht: t = Quellzeit; nur die globalen Schalter gelten
  if (k.art === 'quelle') {
    if (k.quelleId) stand(k.quelleId, t);
    logoZeichnen(true);
    return;
  }

  const plan = holePlan(projekt, k);
  if (!plan || plan.segmente.length === 0) return;
  const seg = plan.segmente[findeSegmentIndex(plan.segmente, t)];
  if (seg?.art === 'titel' && seg.titel) {
    zeichneTitelfolie(ctx, breite, hoehe, seg.titel);
    logoZeichnen(seg.titel.logo !== false); // Scoreboard bleibt auf Titelfolien aus
  }
  // Clip-Zeit: im Clip-Editor = t, in der Playlist t − Start des Eintrags
  if (seg && seg.art !== 'titel' && seg.clipId) {
    const eintrag = plan.eintraege.find((e) => e.index === seg.eintragIndex);
    const clipZeit = k.art === 'clip' ? t : t - (eintrag?.start ?? 0);
    zeichneSpielerObjekte(
      ctx,
      projekt.spielerObjekte,
      seg.clipId,
      clipZeit,
      breite,
      hoehe,
      ziel.bilder,
    );
    zeichneClipZeichnungen(
      ctx,
      projekt.zeichnungen,
      seg.clipId,
      clipZeit,
      breite,
      hoehe,
      ziel.ausblenden,
    );
    if (k.art === 'clip')
      for (const z of ziel.zusatz ?? []) zeichneZeichnung(ctx, z, breite, hoehe, clipZeit);
    const clip = projekt.clips.find((c) => c.id === seg.clipId);
    if (clip) {
      const pos = clipZeitZuQuellZeit(clip, clipZeit);
      if (!istAusgeblendet(ausblendenVon(clip, 'scoreboard'), clipZeit))
        stand(pos.quelleId, pos.quellZeit);
      logoZeichnen(!istAusgeblendet(ausblendenVon(clip, 'logo'), clipZeit));
    }
  }
  const alpha = blendeAlpha(plan, t);
  if (alpha > 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.restore();
  }
}
