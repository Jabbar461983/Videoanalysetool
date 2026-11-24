import type { DockviewApi, DockviewGroupPanel } from 'dockview-react';
import { t } from '../i18n/de-CH';
import { useLayout } from '../store/layout';
import { merkeWiedergabe } from './fensterwechsel';

interface Bildschirm {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
}
interface BildschirmListe {
  screens: Bildschirm[];
  currentScreen: Bildschirm;
}

/** Ob die App ausgelagerte Fenster anbieten soll (Desktop-Browser mit Maus; auf Tablets nicht). */
export function fensterMoeglich(): boolean {
  try {
    return (
      window.matchMedia('(pointer: fine)').matches &&
      window.matchMedia('(min-width: 901px)').matches
    );
  } catch {
    return false;
  }
}

/** Position des zweiten Bildschirms (Fensterverwaltung von Chrome/Edge, mit Erlaubnis). Sonst `undefined`. */
async function zweiterBildschirm(): Promise<
  { left: number; top: number; width: number; height: number } | undefined
> {
  const w = window as unknown as { getScreenDetails?: () => Promise<BildschirmListe> };
  if (typeof w.getScreenDetails !== 'function') return undefined;
  try {
    const d = await w.getScreenDetails();
    const anderer =
      d.screens.find((s) => s !== d.currentScreen && !s.isPrimary) ??
      d.screens.find((s) => s !== d.currentScreen);
    if (!anderer) return undefined;
    return {
      left: anderer.availLeft,
      top: anderer.availTop,
      width: anderer.availWidth,
      height: anderer.availHeight,
    };
  } catch {
    return undefined; // Erlaubnis verweigert
  }
}

/**
 * Lagert die Gruppe in ein eigenes Browserfenster aus. `aufZweitem`: Fenster auf dem zweiten Bildschirm öffnen
 * (braucht die Erlaubnis «Fensterverwaltung»); sonst öffnet es der Browser, der Nutzer zieht es selbst.
 */
export async function oeffneInFenster(
  api: DockviewApi,
  group: DockviewGroupPanel,
  aufZweitem = false,
): Promise<boolean> {
  const meldung = useLayout.getState().setzeMeldung;
  const position = aufZweitem ? await zweiterBildschirm() : undefined;
  if (aufZweitem && !position) meldung(t.layout.keinZweiterBildschirm);
  const wiederherstellen = merkeWiedergabe();
  let ok: boolean;
  try {
    ok = await api.addPopoutGroup(group, {
      position,
      popoutUrl: `${import.meta.env.BASE_URL}popout.html`,
    });
  } catch {
    ok = false;
  }
  if (!ok) meldung(t.layout.popupBlockiert);
  // Das Medienelement wird beim Umzug neu geladen: Position (und laufende Wiedergabe) wiederherstellen
  else window.setTimeout(wiederherstellen, 500);
  return ok;
}
