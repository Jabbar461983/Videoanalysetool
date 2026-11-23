import { create } from 'zustand';
import type { Mikrofongeraet } from '../audio/aufnahme';

export type AufnahmePhase = 'aus' | 'bereit' | 'countdown' | 'laeuft' | 'speichern';

/** Flüchtiger Aufnahmezustand (Mikrofon, Countdown, Pegel). */
interface AufnahmeState {
  phase: AufnahmePhase;
  geraete: Mikrofongeraet[];
  geraetId: string | undefined;
  pegel: number;
  countdown: number;
  /** Spur, in die aufgenommen wird (leer = automatisch) */
  spurId: string | undefined;
  fehler: string | null;
  setze: (patch: Partial<Omit<AufnahmeState, 'setze'>>) => void;
}

export const useAufnahme = create<AufnahmeState>((set) => ({
  phase: 'aus',
  geraete: [],
  geraetId: undefined,
  pegel: 0,
  countdown: 0,
  spurId: undefined,
  fehler: null,
  setze: (patch) => set(patch),
}));
