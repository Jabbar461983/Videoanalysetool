import { create } from 'zustand';

export type SeitenTab = 'quellen' | 'tags' | 'clips' | 'playlist' | 'setup';

interface UiState {
  tab: SeitenTab;
  setzeTab: (t: SeitenTab) => void;
}
export const useUi = create<UiState>((set) => ({
  tab: 'quellen',
  setzeTab: (tab) => set({ tab }),
}));
