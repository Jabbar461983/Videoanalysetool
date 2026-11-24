import type { DockviewApi } from 'dockview-react';
import { create } from 'zustand';

/** Zugriff auf die Dockview-API der Arbeitsfläche (für Menü, Präsentation, Tests) und Hinweise zu Fenstern. */
interface LayoutState {
  api: DockviewApi | null;
  setzeApi: (a: DockviewApi | null) => void;
  /** Anzahl ausgelagerter Fenster */
  fenster: number;
  setzeFenster: (n: number) => void;
  /** Kurzer Hinweis (z. B. Pop-up blockiert), `null` = keiner */
  meldung: string | null;
  setzeMeldung: (m: string | null) => void;
}
export const useLayout = create<LayoutState>((set) => ({
  api: null,
  setzeApi: (api) => set({ api }),
  fenster: 0,
  setzeFenster: (fenster) => set({ fenster }),
  meldung: null,
  setzeMeldung: (meldung) => set({ meldung }),
}));
