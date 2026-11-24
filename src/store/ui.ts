import { create } from 'zustand';

export type SeitenTab = 'quellen' | 'tags' | 'clips' | 'playlist' | 'taktik' | 'setup' | 'export';

interface UiState {
  tab: SeitenTab;
  setzeTab: (t: SeitenTab) => void;
  /** Präsentationsmodus (Vollbild, nur Bühne) */
  praesentation: boolean;
  setzePraesentation: (b: boolean) => void;
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
  setzePraesentation: (praesentation) => set({ praesentation }),
  liveStift: false,
  liveFarbe: '#e53935',
  liveLoeschen: 0,
  setzeLiveStift: (liveStift) => set({ liveStift }),
  setzeLiveFarbe: (liveFarbe) => set({ liveFarbe }),
  loescheLive: () => set((s) => ({ liveLoeschen: s.liveLoeschen + 1 })),
}));
