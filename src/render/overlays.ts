import type { Team } from '../model/typen';
import type { Stand } from '../overlay/spielstand';
import type { LogoBild } from './logo';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Abstand zum Rand: 2.5 % der Bildbreite (CLAUDE.md Abschnitt 6). */
export const RAND_ANTEIL = 0.025;

/** Logo oben rechts. Breite in % der Bildbreite, Seitenverhältnis bleibt, keine Einfärbung. */
export function zeichneLogo(ctx: Ctx, w: number, logo: LogoBild, groessePct: number): void {
  const lw = (Math.max(1, groessePct) / 100) * w;
  const lh = lw * (logo.hoehe / logo.breite);
  const rand = RAND_ANTEIL * w;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(logo.bild, w - rand - lw, rand, lw, lh);
  ctx.restore();
}

/**
 * Scoreboard oben links: [Teamfarbe] KÜR 2 : 1 KÜR [Teamfarbe].
 * Kürzel Arial Black weiss, Stand Gold, Hintergrund #141414 leicht transparent.
 */
export function zeichneScoreboard(ctx: Ctx, w: number, teams: [Team, Team], stand: Stand): void {
  const u = w / 1920;
  const rand = RAND_ANTEIL * w;
  const hoehe = 76 * u;
  const streifen = 16 * u;
  const pad = 20 * u;
  const kFont = `900 ${36 * u}px "Arial Black", Arial, sans-serif`;
  const sFont = `900 ${46 * u}px "Arial Black", Arial, sans-serif`;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = kFont;
  const k1 = teams[0].kuerzel || '---';
  const k2 = teams[1].kuerzel || '---';
  const wk1 = ctx.measureText(k1).width;
  const wk2 = ctx.measureText(k2).width;
  ctx.font = sFont;
  const s1 = String(stand[0]);
  const s2 = String(stand[1]);
  const ws1 = Math.max(ctx.measureText(s1).width, 28 * u);
  const ws2 = Math.max(ctx.measureText(s2).width, 28 * u);
  const wd = ctx.measureText(':').width;
  const luecke = 14 * u;
  const gesamt =
    streifen +
    pad +
    wk1 +
    luecke +
    ws1 +
    luecke +
    wd +
    luecke +
    ws2 +
    luecke +
    wk2 +
    pad +
    streifen;
  const x0 = rand;
  const y0 = rand;
  ctx.fillStyle = 'rgba(20, 20, 20, 0.92)';
  ctx.fillRect(x0, y0, gesamt, hoehe);
  ctx.fillStyle = teams[0].farbe;
  ctx.fillRect(x0, y0, streifen, hoehe);
  ctx.fillStyle = teams[1].farbe;
  ctx.fillRect(x0 + gesamt - streifen, y0, streifen, hoehe);

  const ym = y0 + hoehe / 2 + 2 * u;
  let x = x0 + streifen + pad;
  ctx.font = kFont;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(k1, x, ym);
  x += wk1 + luecke;
  ctx.font = sFont;
  ctx.fillStyle = '#BA990E';
  ctx.textAlign = 'right';
  ctx.fillText(s1, x + ws1, ym);
  x += ws1 + luecke;
  ctx.textAlign = 'left';
  ctx.fillText(':', x, ym);
  x += wd + luecke;
  ctx.textAlign = 'right';
  ctx.fillText(s2, x + ws2, ym);
  x += ws2 + luecke;
  ctx.textAlign = 'left';
  ctx.font = kFont;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(k2, x, ym);
  ctx.restore();
}
