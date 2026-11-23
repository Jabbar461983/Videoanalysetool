import { create } from 'zustand';
import type { Werkzeug, ZeichenAnimation, ZeichenStil, Zeichnung } from '../model/typen';
import { STANDARD_STIL } from '../zeichnen/geometrie';
import { STANDARD_ANIMATION } from '../zeichnen/logik';

export type Modus = 'auswahl' | Werkzeug;

/** Flüchtiger Zeichenzustand: Werkzeug, Standard-Stil, Auswahl, Entwurf und Zwischenablage. */
interface ZeichnenState {
  werkzeug: Modus;
  stil: ZeichenStil;
  druck: boolean;
  /** Animation für neue Zeichnungen */
  animation: ZeichenAnimation;
  auswahlId: string | null;
  /** Zeichnung in Arbeit (noch nicht im Projekt) */
  entwurf: Zeichnung | null;
  /** Gerade verschobene/bearbeitete Fassung einer bestehenden Zeichnung (gleiche Id) */
  ersatz: Zeichnung | null;
  zwischenablage: Zeichnung | null;
  setzeWerkzeug: (w: Modus) => void;
  setzeStil: (patch: Partial<ZeichenStil>) => void;
  setzeDruck: (b: boolean) => void;
  setzeAnimation: (patch: Partial<ZeichenAnimation>) => void;
  waehle: (id: string | null) => void;
  setzeEntwurf: (z: Zeichnung | null) => void;
  setzeErsatz: (z: Zeichnung | null) => void;
  setzeZwischenablage: (z: Zeichnung | null) => void;
}

export const useZeichnen = create<ZeichnenState>((set) => ({
  werkzeug: 'auswahl',
  stil: { ...STANDARD_STIL },
  druck: true,
  animation: { ...STANDARD_ANIMATION },
  auswahlId: null,
  entwurf: null,
  ersatz: null,
  zwischenablage: null,
  setzeWerkzeug: (werkzeug) => set({ werkzeug, entwurf: null, ersatz: null }),
  setzeStil: (patch) => set((s) => ({ stil: { ...s.stil, ...patch } })),
  setzeDruck: (druck) => set({ druck }),
  setzeAnimation: (patch) => set((s) => ({ animation: { ...s.animation, ...patch } })),
  waehle: (auswahlId) => set({ auswahlId }),
  setzeEntwurf: (entwurf) => set({ entwurf }),
  setzeErsatz: (ersatz) => set({ ersatz }),
  setzeZwischenablage: (zwischenablage) => set({ zwischenablage }),
}));
