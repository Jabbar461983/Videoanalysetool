import { create } from 'zustand';
import { leererFilter, type TagFilter } from '../tagging/tagLogik';
import type { Zuordnung } from '../tagging/zuordnung';

/** Flüchtiger Tagging-Zustand: laufende Zuordnung und Filter (nicht im Projekt gespeichert). */
interface TagState {
  zuordnung: Zuordnung | null;
  /** Zeitstempel der letzten Eingabe; die UI schliesst das Fenster nach Ablauf. */
  zuletzt: number;
  filter: TagFilter;
  ausgewaehltTagId: string | null;
  setzeZuordnung: (z: Zuordnung | null) => void;
  setzeFilter: (f: TagFilter) => void;
  waehleTag: (id: string | null) => void;
}

export const ZUORDNUNG_TIMEOUT_MS = 8000;

export const useTagging = create<TagState>((set) => ({
  zuordnung: null,
  zuletzt: 0,
  filter: leererFilter(),
  ausgewaehltTagId: null,
  setzeZuordnung: (zuordnung) => set({ zuordnung, zuletzt: Date.now() }),
  setzeFilter: (filter) => set({ filter }),
  waehleTag: (ausgewaehltTagId) => set({ ausgewaehltTagId }),
}));
