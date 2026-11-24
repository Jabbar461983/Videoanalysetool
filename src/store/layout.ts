import type { DockviewApi } from 'dockview-react';
import { create } from 'zustand';

/** Zugriff auf die Dockview-API der Arbeitsfläche (für Menü, Präsentation, Tests). */
interface LayoutState {
  api: DockviewApi | null;
  setzeApi: (a: DockviewApi | null) => void;
}
export const useLayout = create<LayoutState>((set) => ({
  api: null,
  setzeApi: (api) => set({ api }),
}));
