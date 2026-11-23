import type { PlaylistEintrag } from '../model/typen';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Titel = Extract<PlaylistEintrag, { typ: 'titel' }>;

/** Bulldozers-Titelfolie (CLAUDE.md Abschnitt 6): dunkler Grund, Doppelstreifen, Gold-Kicker, Arial Black. */
export function zeichneTitelfolie(ctx: Ctx, w: number, h: number, titel: Titel): void {
  const u = w / 1920; // alles relativ zur Breite, damit Vorschau und Export identisch aussehen
  ctx.save();
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, w, h);

  // Doppelstreifen (je 30 px bei 1920 Breite, skewX(-8deg), Grün aussen, Gold innen)
  const sx = 120 * u;
  const sy = h * 0.5 - 150 * u;
  const sw = 30 * u;
  const sh = 300 * u;
  const skew = Math.tan((8 * Math.PI) / 180);
  const streifen = (x: number, farbe: string) => {
    ctx.save();
    ctx.setTransform(1, 0, -skew, 1, sy * skew + x, 0);
    ctx.fillStyle = farbe;
    ctx.fillRect(0, sy, sw, sh);
    ctx.restore();
  };
  streifen(sx, '#007057');
  streifen(sx + sw, '#BA990E');

  const x0 = sx + 2 * sw + 70 * u;
  const maxB = w - x0 - 120 * u;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const zeilen = (text: string, font: string, breite: number): string[] => {
    ctx.font = font;
    const woerter = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let cur = '';
    for (const wd of woerter) {
      const test = cur ? `${cur} ${wd}` : wd;
      if (ctx.measureText(test).width > breite && cur) {
        out.push(cur);
        cur = wd;
      } else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  };

  const kickerFont = `700 ${30 * u}px Arial, Helvetica, sans-serif`;
  const titelFont = `900 ${96 * u}px "Arial Black", Arial, sans-serif`;
  const subFont = `400 ${40 * u}px Arial, Helvetica, sans-serif`;
  const kicker = titel.kicker.trim().toLocaleUpperCase('de-CH');
  const tz = zeilen(titel.titel, titelFont, maxB).slice(0, 3);
  const sz = titel.untertitel ? zeilen(titel.untertitel, subFont, maxB).slice(0, 3) : [];

  const kickerH = kicker ? 60 * u : 0;
  const titelH = tz.length * 112 * u;
  const subH = sz.length ? 30 * u + sz.length * 54 * u : 0;
  let y = h / 2 - (kickerH + titelH + subH) / 2;

  if (kicker) {
    ctx.font = kickerFont;
    ctx.fillStyle = '#BA990E';
    // Sperrung 0.2em
    (ctx as CanvasRenderingContext2D).letterSpacing = `${6 * u}px`;
    ctx.fillText(kicker, x0, y + 30 * u);
    (ctx as CanvasRenderingContext2D).letterSpacing = '0px';
    y += kickerH;
  }
  ctx.font = titelFont;
  ctx.fillStyle = '#ffffff';
  for (const z of tz) {
    ctx.fillText(z, x0, y + 88 * u);
    y += 112 * u;
  }
  if (sz.length) {
    y += 30 * u;
    ctx.font = subFont;
    ctx.fillStyle = '#dcdcdc';
    for (const z of sz) {
      ctx.fillText(z, x0, y + 40 * u);
      y += 54 * u;
    }
  }
  ctx.restore();
}
