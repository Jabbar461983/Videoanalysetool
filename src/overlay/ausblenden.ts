import type { Abschnitt, Clip } from '../model/typen';

export type OverlayArt = 'logo' | 'scoreboard';

/** Liegt `t` (Clip-Zeit) in einem der Ausblend-Abschnitte? */
export const istAusgeblendet = (abschnitte: Abschnitt[] | undefined, t: number): boolean =>
  !!abschnitte?.some((a) => t >= a.start - 1e-9 && t < a.ende);

export function ausblendenVon(clip: Pick<Clip, 'ausblenden'>, art: OverlayArt): Abschnitt[] {
  return clip.ausblenden?.[art] ?? [];
}

/** Fügt einen Ausblend-Abschnitt hinzu; überlappende werden zusammengeführt. */
export function fuegeAusblendenHinzu(
  clip: Clip,
  art: OverlayArt,
  start: number,
  ende: number,
): boolean {
  if (!(ende - start >= 0.1)) return false;
  clip.ausblenden ??= { logo: [], scoreboard: [] };
  const liste = clip.ausblenden[art];
  let a = start;
  let b = ende;
  const rest: Abschnitt[] = [];
  for (const x of liste) {
    if (x.ende < a - 1e-9 || x.start > b + 1e-9) rest.push(x);
    else {
      a = Math.min(a, x.start);
      b = Math.max(b, x.ende);
    }
  }
  rest.push({ start: Math.round(a * 1000) / 1000, ende: Math.round(b * 1000) / 1000 });
  rest.sort((x, y) => x.start - y.start);
  clip.ausblenden[art] = rest;
  return true;
}
