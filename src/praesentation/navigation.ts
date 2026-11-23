import type { EintragZeit } from '../wiedergabe/zeitachse';

/**
 * Zielzeit für «nächster/vorheriger Eintrag» im Präsentationsmodus.
 * Vorwärts: Start des nächsten Eintrags; nach dem letzten: Ende (`'ende'`).
 * Rückwärts: Beginn des aktuellen Eintrags, wenn schon mehr als `schwelle` s gespielt, sonst der vorherige.
 */
export function zielEintrag(
  eintraege: Pick<EintragZeit, 'start' | 'dauer'>[],
  t: number,
  richtung: 1 | -1,
  schwelle = 1.5,
): number | 'ende' | null {
  if (eintraege.length === 0) return null;
  let i = eintraege.findIndex((e) => t >= e.start - 1e-9 && t < e.start + e.dauer - 1e-9);
  if (i < 0) i = t < eintraege[0]!.start ? 0 : eintraege.length - 1;
  const e = eintraege[i]!;
  if (richtung === 1) return i + 1 < eintraege.length ? eintraege[i + 1]!.start : 'ende';
  if (t - e.start > schwelle || i === 0) return e.start;
  return eintraege[i - 1]!.start;
}

export function aktuellerEintragIndex(
  eintraege: Pick<EintragZeit, 'start' | 'dauer'>[],
  t: number,
): number {
  const i = eintraege.findIndex((e) => t >= e.start - 1e-9 && t < e.start + e.dauer - 1e-9);
  return i < 0 ? Math.max(0, eintraege.length - 1) : i;
}
