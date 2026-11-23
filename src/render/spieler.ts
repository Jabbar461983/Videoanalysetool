import type { MaskenKeyframe, NormRahmen, SpielerObjekt, Zeichnung } from '../model/typen';
import { zeichneZeichnung } from './zeichnungen';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Flaeche = OffscreenCanvas | HTMLCanvasElement;

/** Geladene Bilder der Spieler-Objekte (Schlüssel siehe `bildSchluessel`). */
export type BilderMap = Map<string, CanvasImageSource>;
export type BildArt = 'bild' | 'ausschnitt' | 'hintergrund';

/** Der Schlüssel enthält Länge und Ende des Data-URL, damit geänderte Bilder neu geladen werden. */
export function bildSchluessel(objId: string, index: number, art: BildArt, daten: string): string {
  return `${objId}|${index}|${art}|${daten.length}|${daten.slice(-24)}`;
}

/** Keyframe, der zum Zeitpunkt gilt (Etappe 8: der letzte Keyframe vor `t`; bis dahin genau einer). */
export function keyframeBei(
  o: SpielerObjekt,
  t: number,
): { kf: MaskenKeyframe; index: number } | null {
  let index = -1;
  for (let i = 0; i < o.maskenKeyframes.length; i++) {
    if (o.maskenKeyframes[i]!.zeit <= t + 1e-9 || index < 0) index = i;
  }
  const kf = o.maskenKeyframes[index];
  return kf ? { kf, index } : null;
}

export const istSpielerSichtbar = (o: SpielerObjekt, t: number): boolean =>
  t >= o.start - 1e-9 && t < o.ende;

let tempFlaeche: Flaeche | null = null;
function temp(b: number, h: number): Flaeche {
  if (tempFlaeche && tempFlaeche.width === b && tempFlaeche.height === h) return tempFlaeche;
  tempFlaeche =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(b, h)
      : Object.assign(document.createElement('canvas'), { width: b, height: h });
  return tempFlaeche;
}
const ctxVon = (f: Flaeche) => f.getContext('2d') as Ctx;

const px = (r: NormRahmen, b: number, h: number) => ({
  x: r.x * b,
  y: r.y * h,
  b: r.b * b,
  h: r.h * h,
});

/**
 * Zeichnet alle Spieler-Objekte des Clips zum Clip-Zeitpunkt `t`.
 * Reihenfolge je Objekt: gefüllter Hintergrund → Spotlight → Ring → Kontur → Spieler (verschoben) → Pfeil → Lupe → Beschriftung.
 */
export function zeichneSpielerObjekte(
  ctx: Ctx,
  objekte: SpielerObjekt[],
  clipId: string,
  t: number,
  breite: number,
  hoehe: number,
  bilder: BilderMap | undefined,
): void {
  for (const o of objekte) {
    if (o.clipId !== clipId || !istSpielerSichtbar(o, t)) continue;
    const k = keyframeBei(o, t);
    if (!k || !bilder) continue;
    const alpha = 1;
    zeichneEinen(ctx, o, k.kf, k.index, alpha, t, breite, hoehe, bilder);
  }
}

function zeichneEinen(
  ctx: Ctx,
  o: SpielerObjekt,
  kf: MaskenKeyframe,
  index: number,
  alpha: number,
  t: number,
  breite: number,
  hoehe: number,
  bilder: BilderMap,
) {
  const bild = bilder.get(bildSchluessel(o.id, index, 'bild', kf.bild));
  const box = px(kf.box, breite, hoehe);
  const verschoben = Math.abs(o.versatz.x) + Math.abs(o.versatz.y) > 1e-6;
  const dx = o.versatz.x * breite;
  const dy = o.versatz.y * hoehe;
  const e = o.effekte;
  ctx.save();
  ctx.globalAlpha = alpha;

  // 1. Alte Stelle mit Hintergrund füllen
  if (verschoben && kf.hintergrund) {
    const hg = bilder.get(bildSchluessel(o.id, index, 'hintergrund', kf.hintergrund));
    if (hg) ctx.drawImage(hg, box.x, box.y, box.b, box.h);
  }

  // 2. Spotlight: Umgebung abdunkeln, Spieler ausgespart (weicher Rand)
  if (e.spotlight && bild) {
    const tc = temp(breite, hoehe);
    const c = ctxVon(tc);
    c.clearRect(0, 0, breite, hoehe);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = `rgba(20,20,20,${e.spotlightStaerke})`;
    c.fillRect(0, 0, breite, hoehe);
    c.globalCompositeOperation = 'destination-out';
    c.shadowColor = '#000000';
    c.shadowBlur = Math.max(2, breite * 0.006);
    c.drawImage(bild, box.x + dx, box.y + dy, box.b, box.h);
    c.drawImage(bild, box.x + dx, box.y + dy, box.b, box.h);
    c.shadowBlur = 0;
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(tc, 0, 0);
  }

  // 3. Ring am Boden
  const fx = (kf.fuss.x + o.versatz.x) * breite;
  const fy = (kf.fuss.y + o.versatz.y) * hoehe;
  if (e.ring) {
    const rx = Math.max(box.b * 0.7, breite * 0.02);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(fx, fy, rx, rx * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = o.farbe;
    ctx.globalAlpha = alpha * 0.25;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(2, breite * 0.004);
    ctx.strokeStyle = o.farbe;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Kontur (farbige Silhouette, mehrfach versetzt) – unter dem Spieler
  if (e.kontur && bild) {
    const sw = Math.max(1, Math.round(box.b));
    const sh = Math.max(1, Math.round(box.h));
    const sil =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(sw, sh)
        : Object.assign(document.createElement('canvas'), { width: sw, height: sh });
    const sc = ctxVon(sil);
    sc.drawImage(bild, 0, 0, sw, sh);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = o.farbe;
    sc.fillRect(0, 0, sw, sh);
    const r = Math.max(2, breite * 0.003);
    for (let i = 0; i < 16; i++) {
      const w = (i / 16) * Math.PI * 2;
      ctx.drawImage(sil, box.x + dx + Math.cos(w) * r, box.y + dy + Math.sin(w) * r, box.b, box.h);
    }
  }

  // 5. Der Spieler selbst (am neuen Ort)
  if (bild && (verschoben || e.kontur)) ctx.drawImage(bild, box.x + dx, box.y + dy, box.b, box.h);

  // 6. Pfeil von alter zu neuer Position
  if (o.pfeil && verschoben) {
    const z: Zeichnung = {
      id: `${o.id}-pfeil`,
      clipId: o.clipId,
      start: o.start,
      ende: o.ende,
      werkzeug: 'pfeil',
      punkte: [kf.fuss, { x: kf.fuss.x + o.versatz.x, y: kf.fuss.y + o.versatz.y }],
      stil: { farbe: o.farbe, staerke: 6, deckkraft: 1, gestrichelt: true, spitze: 'ende' },
      animation: { ein: 'keine', dauerEin: 0, aus: 'keine', dauerAus: 0 },
    };
    ctx.globalAlpha = 1;
    zeichneZeichnung(ctx, z, breite, hoehe, t);
    ctx.globalAlpha = alpha;
  }

  // 7. Lupe (Ausschnitt 2× vergrössert im Kreis neben dem Spieler)
  if (e.lupe) {
    const ausschnitt = bilder.get(bildSchluessel(o.id, index, 'ausschnitt', kf.ausschnitt));
    if (ausschnitt) {
      const lb = px(kf.lupeBox, breite, hoehe);
      const r = Math.max(breite * 0.07, 40);
      const rechts = box.x + dx + box.b + r * 1.4 < breite;
      const cx = rechts ? box.x + dx + box.b + r * 0.9 : box.x + dx - r * 0.9;
      const cy = Math.max(r + 4, Math.min(hoehe - r - 4, box.y + dy + box.h * 0.35));
      const zoom = Math.max(1.5, (r * 2) / Math.max(lb.b, lb.h));
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.drawImage(
        ausschnitt,
        cx - (lb.b * zoom) / 2,
        cy - (lb.h * zoom) / 2,
        lb.b * zoom,
        lb.h * zoom,
      );
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, breite * 0.004);
      ctx.strokeStyle = o.farbe;
      ctx.stroke();
    }
  }

  // 8. Beschriftung über dem Kopf
  if (e.label && e.text.trim()) {
    const gr = Math.max(12, breite * 0.016);
    ctx.font = `bold ${gr}px "Arial Black", Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(e.text).width + gr * 1.2;
    const h = gr * 1.7;
    const x = Math.max(4, Math.min(breite - w - 4, box.x + dx + box.b / 2 - w / 2));
    const y = Math.max(4, box.y + dy - h - gr * 0.4);
    ctx.fillStyle = 'rgba(20,20,20,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.farbe;
    ctx.fillRect(x, y, Math.max(3, gr * 0.25), h);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(e.text, x + gr * 0.7, y + h / 2);
  }
  ctx.restore();
}

/** Standard-Effekte für ein neues Objekt: Spotlight + Ring. */
export const standardEffekte = (text = ''): SpielerObjekt['effekte'] => ({
  spotlight: true,
  spotlightStaerke: 0.6,
  ring: true,
  kontur: false,
  lupe: false,
  label: false,
  text,
});
