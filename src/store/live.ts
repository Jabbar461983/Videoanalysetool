import { create } from 'zustand';

export interface LiveStrich {
  farbe: string;
  punkte: { x: number; y: number }[];
}

/**
 * Live-Zeichnung der Präsentation (nicht im Projekt, nicht im Export). Koordinaten normiert (0–1).
 * Liegt im Store, damit die Zeichnung im Beamer-Fenster und im Spiegelbild des Steuerpults dieselbe ist.
 */
interface LiveState {
  striche: LiveStrich[];
  aktiv: LiveStrich | null;
  /** Zähler: ändert sich bei jeder Änderung (auch an `aktiv`, das direkt erweitert wird) */
  version: number;
  beginne: (s: LiveStrich) => void;
  erweitere: (p: { x: number; y: number }[]) => void;
  beende: () => void;
  brichAb: () => void;
  loesche: () => void;
}

export const useLive = create<LiveState>((set, get) => ({
  striche: [],
  aktiv: null,
  version: 0,
  beginne: (aktiv) => set((s) => ({ aktiv, version: s.version + 1 })),
  erweitere: (p) => {
    const a = get().aktiv;
    if (!a) return;
    a.punkte.push(...p);
    set((s) => ({ version: s.version + 1 }));
  },
  beende: () =>
    set((s) => ({
      striche: s.aktiv ? [...s.striche, s.aktiv] : s.striche,
      aktiv: null,
      version: s.version + 1,
    })),
  brichAb: () => set((s) => ({ aktiv: null, version: s.version + 1 })),
  loesche: () => set((s) => ({ striche: [], aktiv: null, version: s.version + 1 })),
}));
