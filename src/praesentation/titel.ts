import type { PlaylistEintrag, Projekt } from '../model/typen';

/** Kurzer Anzeigename eines Playlist-Eintrags (Titelfolie, Vergleich oder Clipname). */
export function eintragTitel(projekt: Projekt | null, e: PlaylistEintrag | undefined): string {
  if (!e) return '';
  if (e.typ === 'titel') return e.titel;
  if (e.typ === 'vergleich') return `${e.links.beschriftung} ⇄ ${e.rechts.beschriftung}`;
  return projekt?.clips.find((c) => c.id === e.clipId)?.name ?? '';
}
