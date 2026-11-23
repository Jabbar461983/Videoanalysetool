import { create } from 'zustand';
import { produce } from 'immer';
import type { Projekt } from '../model/typen';
import { Historie } from './history';

export type SpeicherStatus = 'gespeichert' | 'ausstehend' | 'fehler';

interface State {
  projekt: Projekt | null;
  status: SpeicherStatus;
  kannUndo: boolean;
  kannRedo: boolean;
  oeffne: (p: Projekt) => void;
  schliesse: () => void;
  /** Undo-fähige Änderung (Command). */
  aendere: (name: string, fn: (p: Projekt) => void) => void;
  /** Änderung ohne Undo-Eintrag (z. B. Abspielposition). */
  aendereStill: (fn: (p: Projekt) => void) => void;
  undo: () => void;
  redo: () => void;
  setzeStatus: (s: SpeicherStatus) => void;
}

const historie = new Historie();

export const useProjekt = create<State>((set, get) => {
  const flags = () => ({ kannUndo: historie.kannUndo, kannRedo: historie.kannRedo });
  const stempel = (p: Projekt): Projekt => ({ ...p, geaendertAm: Date.now() });
  return {
    projekt: null,
    status: 'gespeichert',
    kannUndo: false,
    kannRedo: false,
    oeffne: (p) => {
      historie.leeren();
      set({ projekt: p, status: 'gespeichert', ...flags() });
    },
    schliesse: () => {
      historie.leeren();
      set({ projekt: null, ...flags() });
    },
    aendere: (name, fn) => {
      const p = get().projekt;
      if (!p) return;
      const neu = historie.ausfuehren(p, name, fn);
      if (neu === p) return;
      set({ projekt: stempel(neu), status: 'ausstehend', ...flags() });
    },
    aendereStill: (fn) => {
      const p = get().projekt;
      if (!p) return;
      const neu = produce(p, fn);
      if (neu === p) return;
      set({ projekt: stempel(neu), status: 'ausstehend', ...flags() });
    },
    undo: () => {
      const p = get().projekt;
      if (p) set({ projekt: stempel(historie.undo(p)), status: 'ausstehend', ...flags() });
    },
    redo: () => {
      const p = get().projekt;
      if (p) set({ projekt: stempel(historie.redo(p)), status: 'ausstehend', ...flags() });
    },
    setzeStatus: (status) => set({ status }),
  };
});
