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
  }
}

export const db = new BdvaDb();
