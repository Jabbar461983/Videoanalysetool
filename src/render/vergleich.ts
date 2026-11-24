import type { VergleichZustand } from '../wiedergabe/zeitachse';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Rechteck {
  x: number;
  y: number;
  b: number;
  h: number;
}

/** Abstand zwischen den beiden Hälften, als Anteil der Breite. */
export const VERGLEICH_LUECKE = 0.004;

/** Die beiden Hälften des Bildes (in Pixeln). Vorschau (CSS) und Export benutzen dieselbe Geometrie. */
export function vergleichHaelften(
  breite: number,
  hoehe: number,
): { links: Rechteck; rechts: Rechteck } {
  const luecke = Math.round(breite * VERGLEICH_LUECKE);
  const b = Math.floor((breite - luecke) / 2);
  return {
    links: { x: 0, y: 0, b, h: hoehe },
    rechts: { x: breite - b, y: 0, b, h: hoehe },
  };
}

/** Wohin ein Bild (bw × bh) in ein Rechteck gezeichnet wird: einpassen (ganz, mit Rand) oder füllen (zugeschnitten). */
export function passeEin(
  bw: number,
  bh: number,
  r: Rechteck,
  darstellung: 'einpassen' | 'fuellen',
): {
  sx: number;
  sy: number;
  sb: number;
  sh: number;
  dx: number;
  dy: number;
  db: number;
  dh: number;
} {
  const ar = bw / bh;
  const rar = r.b / r.h;
  if (darstellung === 'einpassen') {
    const db = ar >= rar ? r.b : r.h * ar;
    const dh = ar >= rar ? r.b / ar : r.h;
    return {
      sx: 0,
      sy: 0,
      sb: bw,
      sh: bh,
      dx: r.x + (r.b - db) / 2,
      dy: r.y + (r.h - dh) / 2,
      db,
      dh,
    };
  }
  // füllen: Ausschnitt der Quelle, der das Rechteck genau füllt
  const sb = ar > rar ? bh * rar : bw;
  const sh = ar > rar ? bh : bw / rar;
  return { sx: (bw - sb) / 2, sy: (bh - sh) / 2, sb, sh, dx: r.x, dy: r.y, db: r.b, dh: r.h };
}

/**
 * Zeichnet den Rest des Vergleichs über den Videos: Abdunklung der ruhenden Seite, Beschriftungen und einen
 * goldenen Rahmen um die Seite, die gerade dran ist. Die Videobilder liegen darunter (Vorschau) bzw. sind im Export schon gezeichnet.
 */
export function zeichneVergleich(
  ctx: Ctx,
  breite: number,
  hoehe: number,
  z: VergleichZustand,
): void {
  const h = vergleichHaelften(breite, hoehe);
  const u = breite / 1920;
  const seiten = [
    {
      r: h.links,
      s: z.links,
      info: z.eintrag.links,
      aktiv: z.aktiv === 'links' || z.aktiv === 'beide',
    },
    {
      r: h.rechts,
      s: z.rechts,
      info: z.eintrag.rechts,
      aktiv: z.aktiv === 'rechts' || z.aktiv === 'beide',
    },
  ];
  ctx.save();
  for (const { r, s, info, aktiv } of seiten) {
    if (s.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.dim})`;
      ctx.fillRect(r.x, r.y, r.b, r.h);
    }
    if (aktiv && z.aktiv !== 'beide') {
      const d = Math.max(2, 4 * u);
      ctx.strokeStyle = '#BA990E';
      ctx.lineWidth = d;
      ctx.strokeRect(r.x + d / 2, r.y + d / 2, r.b - d, r.h - d);
    }
    const text = info.beschriftung.trim();
    if (text) {
      const schrift = Math.round(34 * u);
      ctx.font = `bold ${schrift}px "Arial Black", Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const gross = text.toUpperCase();
      const tb = ctx.measureText(gross).width;
      const padX = 18 * u;
      const bh = schrift * 1.7;
      const x = r.x + 24 * u;
      const y = r.y + 24 * u;
      ctx.globalAlpha = aktiv || z.aktiv === null ? 1 : 0.8;
      ctx.fillStyle = 'rgba(20,20,20,0.9)';
      ctx.fillRect(x, y, tb + 2 * padX + 10 * u, bh);
      ctx.fillStyle = info.farbe;
      ctx.fillRect(x, y, 10 * u, bh);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(gross, x + 10 * u + padX, y + bh / 2 + 1 * u);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
