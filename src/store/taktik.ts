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
  /** Klick-Modus: Füsse im Video anklicken → Marker auf der Tafel */
  klickModus: 'team1' | 'team2' | 'ball' | null;
  /** Situation, die im Klick-Modus gerade aufgebaut wird */
  uebernahmeId: string | null;
  /** Rückmeldung zur Übernahme (Erkennung läuft, Ergebnis, Fehler) */
  meldung: string | null;
  beschaeftigt: boolean;
  setze: (patch: Partial<Omit<TaktikState, 'setze'>>) => void;
}

export const useTaktik = create<TaktikState>((set) => ({
  editorOffen: false,
  situationId: null,
  werkzeug: 'auswahl',
  markerId: null,
  kalibrierungOffen: false,
  klickModus: null,
  uebernahmeId: null,
  meldung: null,
  beschaeftigt: false,
  setze: (patch) => set(patch),
}));
