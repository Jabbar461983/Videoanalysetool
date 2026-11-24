import { create } from 'zustand';
import { useLive } from './live';

export type SeitenTab = 'quellen' | 'tags' | 'clips' | 'playlist' | 'taktik' | 'setup' | 'export';

interface UiState {
  tab: SeitenTab;
  setzeTab: (t: SeitenTab) => void;
  /** Präsentationsmodus (Vollbild, nur Bühne) */
  praesentation: boolean;
  /** Präsentation läuft im zweiten Fenster (Beamer); das Hauptfenster ist das Steuerpult */
  praesentationFenster: boolean;
  setzePraesentation: (b: boolean, imFenster?: boolean) => void;
  /** Live-Stift: Maus/Finger zeichnen mit (Stift zeichnet immer) */
  liveStift: boolean;
  liveFarbe: string;
  /** Zähler: bei Änderung wird die Live-Zeichnung gelöscht */
  liveLoeschen: number;
  setzeLiveStift: (b: boolean) => void;
  setzeLiveFarbe: (f: string) => void;
  loescheLive: () => void;
}
export const useUi = create<UiState>((set) => ({
  tab: 'quellen',
  setzeTab: (tab) => set({ tab }),
  praesentation: false,
  praesentationFenster: false,
  setzePraesentation: (praesentation, imFenster = false) =>
    set({ praesentation, praesentationFenster: praesentation && imFenster }),
  liveStift: false,
  liveFarbe: '#e53935',
  liveLoeschen: 0,
  setzeLiveStift: (liveStift) => set({ liveStift }),
  setzeLiveFarbe: (liveFarbe) => set({ liveFarbe }),
  loescheLive: () => {
    useLive.getState().loesche();
    set((s) => ({ liveLoeschen: s.liveLoeschen + 1 }));
  },
}));
