import { create } from 'zustand';

/** Flüchtiger Player-Zustand (nicht im Projekt, nicht undo-fähig). */
interface PlayerState {
  zeit: number;
  spielt: boolean;
  tempo: number;
  fehler: string | null;
  setZeit: (t: number) => void;
  setSpielt: (b: boolean) => void;
  setTempo: (r: number) => void;
  setFehler: (m: string | null) => void;
  /** Wird vom Player-Element registriert; Timeline/Tastatur rufen es auf. */
  suche: (t: number) => void;
  registriereSuche: (fn: (t: number) => void) => void;
}

export const usePlayer = create<PlayerState>((set) => ({
  zeit: 0,
  spielt: false,
  tempo: 1,
  fehler: null,
  setZeit: (zeit) => set({ zeit }),
  setSpielt: (spielt) => set({ spielt }),
  setTempo: (tempo) => set({ tempo }),
  setFehler: (fehler) => set({ fehler }),
  suche: () => {},
  registriereSuche: (suche) => set({ suche }),
}));
