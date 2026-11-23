import type { SpurPunkt } from './trackingTypen';

import type { SpurN } from '../model/typen';
export type { SpurN };

export function normalisiere(punkte: SpurPunkt[], breite: number, hoehe: number): SpurN[] {
  return punkte.map((p) => ({
    zeit: p.zeit,
    cx: p.box.cx / breite,
    cy: p.box.cy / hoehe,
    b: p.box.b / breite,
    h: p.box.h / hoehe,
    konfidenz: p.konfidenz,
    zustand: p.zustand,
  }));
}

const mittel = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

/** Gleitender Mittelwert über `fenster` Punkte (ungerade) für Position und Grösse. */
export function glaette(spur: SpurN[], fenster = 5): SpurN[] {
  const r = Math.floor(fenster / 2);
  return spur.map((p, i) => {
    const nachbarn = spur.slice(Math.max(0, i - r), i + r + 1);
    return {
      ...p,
      cx: mittel(nachbarn.map((n) => n.cx)),
      cy: mittel(nachbarn.map((n) => n.cy)),
      b: mittel(nachbarn.map((n) => n.b)),
      h: mittel(nachbarn.map((n) => n.h)),
    };
  });
}

/** Box zur Quellzeit `t` (linear zwischen den Punkten, ausserhalb: erster/letzter Punkt). */
export function spurBei(spur: SpurN[], t: number): SpurN | null {
  if (spur.length === 0) return null;
  if (t <= spur[0]!.zeit) return spur[0]!;
  const letzter = spur[spur.length - 1]!;
  if (t >= letzter.zeit) return letzter;
  let lo = 0;
  let hi = spur.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (spur[m]!.zeit <= t) lo = m;
    else hi = m;
  }
  const a = spur[lo]!;
  const b = spur[hi]!;
  const f = (t - a.zeit) / (b.zeit - a.zeit || 1);
  const l = (x: number, y: number) => x + (y - x) * f;
  return {
    zeit: t,
    cx: l(a.cx, b.cx),
    cy: l(a.cy, b.cy),
    b: l(a.b, b.b),
    h: l(a.h, b.h),
    konfidenz: Math.min(a.konfidenz, b.konfidenz),
    zustand: a.zustand === 'verloren' || b.zustand === 'verloren' ? 'verloren' : a.zustand,
  };
}

/** Abschnitte (Quellzeit), in denen der Spieler verloren oder unsicher ist, mindestens `minDauer` lang. */
export function unsichereStellen(
  spur: SpurN[],
  minDauer = 0.4,
): { von: number; bis: number; verloren: boolean }[] {
  const out: { von: number; bis: number; verloren: boolean }[] = [];
  let start: number | null = null;
  let verloren = false;
  let letzte = 0;
  for (const p of spur) {
    const schlecht = p.zustand !== 'ok';
    if (schlecht && start === null) {
      start = p.zeit;
      verloren = false;
    }
    if (schlecht && p.zustand === 'verloren') verloren = true;
    if (!schlecht && start !== null) {
      if (letzte - start >= minDauer || verloren) out.push({ von: start, bis: letzte, verloren });
      start = null;
    }
    letzte = p.zeit;
  }
  if (start !== null) out.push({ von: start, bis: letzte, verloren });
  return out;
}

/** Anteil (0–1) der Punkte im Zustand «verloren». */
export const verlorenAnteil = (spur: SpurN[]): number =>
  spur.length === 0 ? 0 : spur.filter((p) => p.zustand === 'verloren').length / spur.length;

/** Ersetzt in `alt` alles ab dem ersten Punkt von `neu` durch `neu` (Korrektur-Lauf). */
export function fuegeSpurenZusammen(alt: SpurN[], neu: SpurN[]): SpurN[] {
  if (neu.length === 0) return alt;
  const ab = neu[0]!.zeit;
  return [...alt.filter((p) => p.zeit < ab - 1e-6), ...neu];
}
