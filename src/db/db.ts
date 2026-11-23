import Dexie, { type Table } from 'dexie';
import type { Projekt } from '../model/typen';

export interface HandleRow {
  quelleKey: string;
  handle: FileSystemFileHandle;
}
export interface ThumbRow {
  key: string;
  quelleKey: string;
  zeit: number;
  blob: Blob;
}
export interface ProxyRow {
  id: string;
  blob: Blob;
}
export interface WiederherstellungRow {
  projektId: string;
  zeitpunkt: number;
  projekt: Projekt;
}
export type VorlageTyp = 'team' | 'kader' | 'tagset' | 'zeichnung';
export interface VorlageRow {
  id: string;
  typ: VorlageTyp;
  name: string;
  daten: unknown;
  standard: boolean;
}
export interface AudioRow {
  id: string;
  blob: Blob;
  mime: string;
  /** Länge in Sekunden */
  dauer: number;
  /** Wellenform-Spitzen (0–1), PEAKS_PRO_SEKUNDE je Sekunde */
  peaks: Float32Array;
  erstelltAm: number;
}
export interface MetaRow {
  key: string;
  value: unknown;
}

export class BdvaDb extends Dexie {
  projekte!: Table<Projekt, string>;
  handles!: Table<HandleRow, string>;
  thumbs!: Table<ThumbRow, string>;
  proxys!: Table<ProxyRow, string>;
  wiederherstellung!: Table<WiederherstellungRow, string>;
  meta!: Table<MetaRow, string>;
  vorlagen!: Table<VorlageRow, string>;
  audio!: Table<AudioRow, string>;

  constructor(name = 'bulldozers-videoanalyse') {
    super(name);
    this.version(1).stores({
      projekte: 'id, geaendertAm',
      handles: 'quelleKey',
      thumbs: 'key, quelleKey',
      proxys: 'id',
      wiederherstellung: 'projektId',
      meta: 'key',
    });
    this.version(2).stores({ vorlagen: 'id, typ' });
    this.version(3).stores({ audio: 'id' });
  }
}

export const db = new BdvaDb();
