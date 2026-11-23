import { create } from 'zustand';

/** Flüchtiger Schnitt-Zustand: gesetzte In/Out-Punkte und ausgewählter Clip. */
interface SchnittState {
  inPunkt: number | null;
  outPunkt: number | null;
  quelleId: string | null;
  gewaehlterClipId: string | null;
  setzeIn: (t: number, quelleId: string) => void;
  setzeOut: (t: number, quelleId: string) => void;
  loeschePunkte: () => void;
  waehleClip: (id: string | null) => void;
}

export const useSchnitt = create<SchnittState>((set) => ({
  inPunkt: null,
  outPunkt: null,
  quelleId: null,
  gewaehlterClipId: null,
  setzeIn: (t, quelleId) =>
    set((s) => ({ inPunkt: t, quelleId, outPunkt: s.quelleId === quelleId ? s.outPunkt : null })),
  setzeOut: (t, quelleId) =>
    set((s) => ({ outPunkt: t, quelleId, inPunkt: s.quelleId === quelleId ? s.inPunkt : null })),
  loeschePunkte: () => set({ inPunkt: null, outPunkt: null, quelleId: null }),
  waehleClip: (gewaehlterClipId) => set({ gewaehlterClipId }),
}));
