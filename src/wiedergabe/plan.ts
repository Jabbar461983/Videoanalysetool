import type { Projekt } from '../model/typen';
import type { ProgrammArt } from '../store/programm';
import { clipPlan, playlistZeitplan, type Zeitplan } from './zeitachse';

/** Zeitplan des aktuellen Programms (Clip oder Playlist); `null` im Quell-Modus oder bei fehlendem Inhalt. */
export function baueProgrammPlan(
  projekt: Projekt | null,
  art: ProgrammArt,
  clipId?: string,
  playlistId?: string,
): Zeitplan | null {
  if (!projekt) return null;
  if (art === 'clip') {
    const c = projekt.clips.find((x) => x.id === clipId);
    return c ? clipPlan(c) : null;
  }
  if (art === 'playlist') {
    const pl = projekt.playlisten.find((x) => x.id === playlistId);
    return pl ? playlistZeitplan(pl, projekt.clips) : null;
  }
  return null;
}
