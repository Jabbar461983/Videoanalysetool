import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useUi } from '../store/ui';
import { aktuellerPlan, spieler } from '../wiedergabe/transport';
import { zielEintrag } from './navigation';

/** Startet die Präsentation einer Playlist: Vollbild, Wiedergabe ab Anfang. */
export async function startepraesentation(playlistId: string): Promise<void> {
  useProgramm.getState().oeffnePlaylist(playlistId, { abspielen: true, start: 0 });
  useUi.getState().setzePraesentation(true);
  try {
    await document.documentElement.requestFullscreen();
  } catch {
    /* Vollbild nicht erlaubt: der Modus läuft trotzdem im Fenster */
  }
}

export function beendePraesentation(): void {
  if (!useUi.getState().praesentation) return;
  spieler.pausiere();
  useUi.getState().setzePraesentation(false);
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

/** Nächster (+1) oder vorheriger (−1) Playlist-Eintrag; die Wiedergabe läuft weiter, falls sie lief. */
export function naechsterEintrag(richtung: 1 | -1): void {
  const plan = aktuellerPlan();
  if (!plan) return;
  const ziel = zielEintrag(plan.eintraege, usePlayer.getState().zeit, richtung);
  if (ziel === null) return;
  useUi.getState().loescheLive();
  if (ziel === 'ende') {
    spieler.pausiere();
    usePlayer.getState().suche(Math.max(0, plan.dauer - 0.04));
  } else usePlayer.getState().suche(ziel);
}
