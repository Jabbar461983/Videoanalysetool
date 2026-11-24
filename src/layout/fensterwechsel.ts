import { usePlayer } from '../store/player';
import { toggleWiedergabe } from '../wiedergabe/transport';

/**
 * Merkt sich die Wiedergabe (Position, läuft/steht) vor dem Schliessen eines ausgelagerten Fensters.
 * Das Medienelement wird beim Zurückholen neu initialisiert und springt sonst an den Anfang
 * (im Versuch beobachtet). `wiederherstellen` setzt die Position neu und spielt weiter, falls es lief.
 */
export function merkeWiedergabe(): () => void {
  const p = usePlayer.getState();
  const zeit = p.zeit;
  const lief = p.spielt;
  return () => {
    usePlayer.getState().suche(zeit);
    if (lief) {
      window.setTimeout(() => {
        if (!usePlayer.getState().spielt) toggleWiedergabe();
      }, 250);
    }
  };
}
