import { fensterVon } from '../layout/fenster';
import { oeffneInFenster } from '../layout/popout';
import { t } from '../i18n/de-CH';
import { useLayout } from '../store/layout';
import { useLive } from '../store/live';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useUi } from '../store/ui';
import { aktuellerPlan, spieler } from '../wiedergabe/transport';
import { zielEintrag } from './navigation';

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Das Beamer-Fenster, solange eine Präsentation darin läuft. */
let beamer: Window | null = null;
let beamerWarImVollbild = false;
let beamerAufraeumen: (() => void) | null = null;

const BAND = 'bd-praesi';

/**
 * Stellt sicher, dass die Bühne in einem eigenen Fenster liegt (wenn möglich auf dem zweiten Bildschirm),
 * blendet dort die Registerköpfe aus und versucht das Vollbild.
 */
async function bereiteBeamerFenster(): Promise<Window | null> {
  const api = useLayout.getState().api;
  const g = api?.getPanel('buehne')?.group;
  if (!api || !g) return null;
  const finde = () => api.getPopouts().find((p) => p.group.panels.some((x) => x.id === 'buehne'));
  if (!finde()) {
    if (!(await oeffneInFenster(api, g, true))) return null;
    await warte(900); // Bühne und Wiedergabe richten sich im neuen Fenster ein
  }
  const w = finde()?.window;
  if (!w) return null;
  w.document.body.classList.add(BAND);
  beamer = w;
  beamerWarImVollbild = false;
  const beiVollbild = () => {
    if (w.document.fullscreenElement) beamerWarImVollbild = true;
    else if (beamerWarImVollbild) beendePraesentation(); // Esc im Vollbild beendet die Präsentation
  };
  const doppelklick = () => {
    if (w.document.fullscreenElement) void w.document.exitFullscreen().catch(() => {});
    else void w.document.documentElement.requestFullscreen().catch(() => {});
  };
  w.document.addEventListener('fullscreenchange', beiVollbild);
  w.document.addEventListener('dblclick', doppelklick);
  beamerAufraeumen = () => {
    try {
      w.document.removeEventListener('fullscreenchange', beiVollbild);
      w.document.removeEventListener('dblclick', doppelklick);
      w.document.body.classList.remove(BAND);
      if (w.document.fullscreenElement) void w.document.exitFullscreen().catch(() => {});
    } catch {
      /* Fenster schon zu */
    }
  };
  // Aus einem Klick im Hauptfenster ist das Vollbild im anderen Fenster meist nicht erlaubt: dann per Klick dort
  void w.document.documentElement.requestFullscreen().catch(() => {});
  return w;
}

/** Startet die Präsentation einer Playlist: Vollbild, Wiedergabe ab Anfang. `ziel`: dieses Fenster oder zweites Fenster (Beamer). */
export async function startepraesentation(
  playlistId: string,
  ziel: 'hier' | 'fenster' = 'hier',
): Promise<void> {
  useLive.getState().loesche();
  if (ziel === 'fenster') {
    const w = await bereiteBeamerFenster();
    if (w) {
      useProgramm.getState().oeffnePlaylist(playlistId, { abspielen: true, start: 0 });
      useUi.getState().setzePraesentation(true, true);
      return;
    }
    useLayout.getState().setzeMeldung(t.praesentation.keinBeamer);
  }
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
  useLive.getState().loesche();
  beamerAufraeumen?.();
  beamerAufraeumen = null;
  beamer = null;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

/** Vollbild im Beamer-Fenster umschalten (klappt nur, wenn der Browser es aus diesem Klick heraus erlaubt). */
export function beamerVollbild(): void {
  const d = beamer?.document;
  if (!d) return;
  if (d.fullscreenElement) void d.exitFullscreen().catch(() => {});
  else void d.documentElement.requestFullscreen().catch(() => {});
}

/** Das Beamer-Fenster (oder `null`). */
export const beamerFenster = (): Window | null => beamer;

/** Fenster der Bühne, falls ausgelagert, sonst das Hauptfenster. */
export const buehnenFenster = (): Window => fensterVon(spieler.elemente?.[0]);

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
