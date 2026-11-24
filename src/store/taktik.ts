import { create } from 'zustand';

export type TafelWerkzeug =
  'auswahl' | 'team1' | 'team2' | 'ball' | 'laufweg' | 'pass' | 'schuss' | 'loeschen';

/** Flüchtiger Zustand der Taktiktafel (nicht im Projekt gespeichert). */
interface TaktikState {
  editorOffen: boolean;
  /** In der Tafel bearbeitete Situation */
  situationId: string | null;
  werkzeug: TafelWerkzeug;
  markerId: string | null;
  kalibrierungOffen: boolean;
  setze: (patch: Partial<Omit<TaktikState, 'setze'>>) => void;
}

export const useTaktik = create<TaktikState>((set) => ({
  editorOffen: false,
  situationId: null,
  werkzeug: 'auswahl',
  markerId: null,
  kalibrierungOffen: false,
  setze: (patch) => set(patch),
}));
