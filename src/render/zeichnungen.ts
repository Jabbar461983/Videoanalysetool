import type { Zeichnung } from '../model/typen';
import {
  laenge,
  markerRadius,
  pfad,
  skala,
  spitzenLaenge,
  teilPfad,
  textBox,
  textSchrift,
  zuPx,
  type P,
} from '../zeichnen/geometrie';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Deckkraft (0–1) und Aufbau-Anteil (0–1) der Zeichnung zum Clip-Zeitpunkt `t`; `null` = nicht sichtbar. */
export function zustandZu(z: Zeichnung, t: number): { alpha: number; aufbau: number } | null {
  if (t < z.start - 1e-9 || t >= z.ende) return null;
  const a = z.animation;
  let alpha = 1;
  let aufbau = 1;
  const seit = t - z.start;
  const bis = z.ende - t;
  if (a.ein === 'einblenden' && a.dauerEin > 0) alpha = Math.min(alpha, seit / a.dauerEin);
  if (a.ein === 'zeichnen' && a.dauerEin > 0) aufbau = Math.min(1, seit / a.dauerEin);
  if (a.aus === 'ausblenden' && a.dauerAus > 0) alpha = Math.min(alpha, bis / a.dauerAus);
  return { alpha: Math.min(1, Math.max(0, alpha)), aufbau: Math.min(1, Math.max(0, aufbau)) };
}

const hell = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

function linie(ctx: Ctx, pts: P[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
}

function pfeilspitze(ctx: Ctx, an: P, von: P, groesse: number) {
  const w = Math.atan2(an.y - von.y, an.x - von.x);
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(an.x, an.y);
  ctx.lineTo(an.x - groesse * Math.cos(w - 0.42), an.y - groesse * Math.sin(w - 0.42));
  ctx.lineTo(an.x - groesse * Math.cos(w + 0.42), an.y - groesse * Math.sin(w + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Zeichnet eine Zeichnung zum Clip-Zeitpunkt t. Grössen skalieren mit der Bildbreite (Vorschau = Export). */
export function zeichneZeichnung(ctx: Ctx, z: Zeichnung, w: number, h: number, t: number): void {
  const zs = zustandZu(z, t);
  if (!zs || zs.alpha <= 0) return;
  const u = skala(w);
  const st = z.stil;
  const breite = Math.max(1, st.staerke * u);
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, st.deckkraft * zs.alpha));
  ctx.strokeStyle = st.farbe;
  ctx.fillStyle = st.farbe;
  ctx.lineWidth = breite;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (st.gestrichelt) ctx.setLineDash([breite * 2.6, breite * 2.2]);

  switch (z.werkzeug) {
    case 'pfeil':
    case 'linie':
    case 'kreis': {
      const voll = pfad(z, w, h);
      const teil = teilPfad(voll, zs.aufbau);
      if (teil.length < 2) break;
      // Bei Pfeilen endet der Strich vor der Spitze, damit sie nicht über die Spitze hinausragt
      const mitSpitze = z.werkzeug === 'pfeil' && st.spitze !== 'keine';
      const kopf = spitzenLaenge(st) * u;
      let strich = teil;
      if (mitSpitze && laenge(teil) > kopf * 1.2)
        strich = teilPfad(teil, 1 - (kopf * 0.6) / laenge(teil));
      linie(ctx, strich);
      ctx.stroke();
      if (mitSpitze && teil.length >= 2 && zs.aufbau > 0.02) {
        pfeilspitze(ctx, teil[teil.length - 1]!, teil[Math.max(0, teil.length - 3)]!, kopf);
        if (st.spitze === 'beide' && zs.aufbau >= 1)
          pfeilspitze(ctx, voll[0]!, voll[Math.min(2, voll.length - 1)]!, kopf);
      }
      break;
    }
    case 'freihand': {
      const voll = pfad(z, w, h);
      const teil = teilPfad(voll, zs.aufbau);
      const druck = z.punkte.some((p) => p.d !== undefined);
      if (!druck || teil.length < 2) {
        linie(ctx, teil);
        ctx.stroke();
        break;
      }
      // variable Breite: Druck der nächstliegenden Rohpunkte, segmentweise
      ctx.setLineDash([]);
      const raw = z.punkte;
      for (let i = 1; i < teil.length; i++) {
        const k = Math.min(
          raw.length - 1,
          Math.round(((i - 0.5) / (voll.length - 1)) * (raw.length - 1)),
        );
        const d = raw[k]?.d ?? 0.5;
        ctx.lineWidth = Math.max(1, breite * (0.35 + 1.3 * d));
        ctx.beginPath();
        ctx.moveTo(teil[i - 1]!.x, teil[i - 1]!.y);
        ctx.lineTo(teil[i]!.x, teil[i]!.y);
        ctx.stroke();
      }
      break;
    }
    case 'zone': {
      const poly = pfad(z, w, h);
      if (poly.length < 3) {
        linie(ctx, poly);
        ctx.stroke();
        break;
      }
      linie(ctx, poly);
      ctx.closePath();
      ctx.globalAlpha *= 0.35;
      ctx.fill();
      ctx.globalAlpha = Math.min(1, st.deckkraft * zs.alpha);
      ctx.stroke();
      break;
    }
    case 'text': {
      const s = textSchrift(st) * u;
      const b = textBox(z, w, h);
      ctx.setLineDash([]);
      ctx.globalAlpha = Math.min(1, zs.alpha);
      ctx.fillStyle = hell(st.farbe) < 0.4 ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)';
      ctx.fillRect(b.x, b.y, b.b, b.h);
      ctx.globalAlpha = Math.min(1, st.deckkraft * zs.alpha);
      ctx.fillStyle = st.farbe;
      ctx.font = `700 ${s}px Arial, Helvetica, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(z.text ?? '', b.x + s * 0.35, b.y + s * 0.35);
      break;
    }
    case 'marker': {
      const m = zuPx(z.punkte[0] ?? { x: 0, y: 0 }, w, h);
      const r = markerRadius(st) * u;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 2 * u);
      ctx.strokeStyle = hell(st.farbe) < 0.4 ? '#ffffff' : '#000000';
      ctx.stroke();
      ctx.fillStyle = hell(st.farbe) < 0.5 ? '#ffffff' : '#000000';
      ctx.font = `900 ${r * 1.1}px "Arial Black", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(z.nummer ?? ''), m.x, m.y + r * 0.04);
      break;
    }
  }
  ctx.restore();
}

/** Alle Zeichnungen eines Clips in Ebenenreihenfolge (hinten → vorne). `ausser`: Ids, die gerade verschoben werden. */
export function zeichneClipZeichnungen(
  ctx: Ctx,
  liste: Zeichnung[],
  clipId: string,
  clipZeit: number,
  w: number,
  h: number,
  ausser?: ReadonlySet<string>,
): void {
  for (const z of liste) {
    if (z.clipId !== clipId || ausser?.has(z.id)) continue;
    zeichneZeichnung(ctx, z, w, h, clipZeit);
  }
}
