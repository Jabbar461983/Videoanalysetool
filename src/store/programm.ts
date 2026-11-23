import { create } from 'zustand';

/** Was gerade im Player läuft: die Quelle selbst, ein einzelner Clip (Clip-Editor) oder eine Playlist. */
export type ProgrammArt = 'quelle' | 'clip' | 'playlist';

interface ProgrammState {
  art: ProgrammArt;
  clipId?: string;
  playlistId?: string;
  /** Quelle, nach deren Bildformat die Bühne gerade dimensioniert wird. */
  anzeigeQuelleId?: string;
  fehler: string | null;
  /** Beim Öffnen sofort abspielen und ab `startZeit` beginnen. */
  autoplay: boolean;
  startZeit: number;
  oeffneClip: (clipId: string) => void;
  oeffnePlaylist: (playlistId: string, optionen?: { abspielen?: boolean; start?: number }) => void;
  zurQuelle: () => void;
  setzeAnzeigeQuelle: (id: string | undefined) => void;
  setzeFehler: (m: string | null) => void;
}

export const useProgramm = create<ProgrammState>((set) => ({
  art: 'quelle',
  fehler: null,
  autoplay: false,
  startZeit: 0,
  oeffneClip: (clipId) =>
    set({
      art: 'clip',
      clipId,
      playlistId: undefined,
      fehler: null,
      autoplay: false,
      startZeit: 0,
    }),
  oeffnePlaylist: (playlistId, o) =>
    set({
      art: 'playlist',
      playlistId,
      clipId: undefined,
      fehler: null,
      autoplay: o?.abspielen ?? false,
      startZeit: o?.start ?? 0,
    }),
  zurQuelle: () =>
    set({ art: 'quelle', clipId: undefined, playlistId: undefined, fehler: null, autoplay: false }),
  setzeAnzeigeQuelle: (anzeigeQuelleId) => set({ anzeigeQuelleId }),
  setzeFehler: (fehler) => set({ fehler }),
}));
