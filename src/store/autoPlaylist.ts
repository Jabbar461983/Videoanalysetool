import { create } from 'zustand';
import { leereAuswahl, type AutoAuswahl } from '../schnitt/autoPlaylist';

/** Flüchtiger Zustand des Dialogs «Playlist automatisch füllen» (nicht im Projekt gespeichert). */
interface AutoState {
  offen: boolean;
  auswahl: AutoAuswahl;
  oeffne: (vorbelegt?: Partial<AutoAuswahl>) => void;
  schliesse: () => void;
}

export const useAutoPlaylist = create<AutoState>((set) => ({
  offen: false,
  auswahl: leereAuswahl(),
  oeffne: (vorbelegt) => set({ offen: true, auswahl: { ...leereAuswahl(), ...vorbelegt } }),
  schliesse: () => set({ offen: false }),
}));
