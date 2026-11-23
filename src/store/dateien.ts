import { create } from 'zustand';
import { db } from '../db/db';
import { dateiKey } from '../db/projekte';
import type { Quelle } from '../model/typen';
import { holeDateiVonHandle } from '../video/handles';

/** Laufzeit-Zuordnung Quelle → verfügbare Datei (nicht persistent; Dateien liegen nie in der DB). */
interface DateiState {
  dateien: Record<string, File>;
  urls: Record<string, string>;
  setze: (quelleId: string, datei: File) => void;
  entferne: (quelleId: string) => void;
  versuche: (q: Quelle, fragen: boolean) => Promise<boolean>;
}

export const useDateien = create<DateiState>((set, get) => ({
  dateien: {},
  urls: {},
  setze: (id, datei) => {
    const alt = get().urls[id];
    if (alt) URL.revokeObjectURL(alt);
    set((s) => ({
      dateien: { ...s.dateien, [id]: datei },
      urls: { ...s.urls, [id]: URL.createObjectURL(datei) },
    }));
  },
  entferne: (id) => {
    const alt = get().urls[id];
    if (alt) URL.revokeObjectURL(alt);
    set((s) => {
      const d = { ...s.dateien },
        u = { ...s.urls };
      delete d[id];
      delete u[id];
      return { dateien: d, urls: u };
    });
  },
  /** Proxy zuerst (falls vorhanden), sonst Handle. */
  versuche: async (q, fragen) => {
    if (q.proxyId) {
      const row = await db.proxys.get(q.proxyId);
      if (row) {
        get().setze(q.id, new File([row.blob], q.dateiname + '.proxy.mp4', { type: 'video/mp4' }));
        return true;
      }
    }
    const f = await holeDateiVonHandle(dateiKey(q), fragen);
    if (f) {
      get().setze(q.id, f);
      return true;
    }
    return false;
  },
}));
