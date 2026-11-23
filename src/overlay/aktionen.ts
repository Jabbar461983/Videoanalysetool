import { useProjekt } from '../store/projektStore';

/** Hotkeys L / S und Knöpfe im Player: globale Schalter (ohne Undo-Eintrag, wie Ansichtseinstellungen). */
export function schalteLogo(): void {
  useProjekt.getState().aendereStill((p) => {
    p.einstellungen.logoAnzeigen = !p.einstellungen.logoAnzeigen;
  });
}
export function schalteScoreboard(): void {
  useProjekt.getState().aendereStill((p) => {
    p.einstellungen.scoreboardAnzeigen = !p.einstellungen.scoreboardAnzeigen;
  });
}
