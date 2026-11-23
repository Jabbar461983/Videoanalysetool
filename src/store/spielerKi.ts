import { create } from 'zustand';

/** Flüchtiger Zustand des Spieler-Werkzeugs (nicht im Projekt gespeichert). */
interface SpielerKiState {
  auswahlId: string | null;
  status: 'bereit' | 'laedt' | 'rechnet' | 'fuellt' | 'fehler';
  prozent: number;
  geraet?: 'webgpu' | 'wasm';
  meldung: string | null;
  /** Technische Fehlermeldung (für die Fehlersuche) */
  detail: string | null;
  /** Verschieben-Modus: Ziehen im ausgewählten Spieler bewegt ihn */
  verschieben: boolean;
  /** Art des nächsten Klicks (für Touch ohne Shift/Alt) */
  klickArt: 'neu' | 'plus' | 'minus';
  setze: (patch: Partial<Omit<SpielerKiState, 'setze'>>) => void;
}

export const useSpielerKi = create<SpielerKiState>((set) => ({
  auswahlId: null,
  status: 'bereit',
  prozent: 0,
  meldung: null,
  detail: null,
  verschieben: false,
  klickArt: 'neu',
  setze: (patch) => set(patch),
}));
