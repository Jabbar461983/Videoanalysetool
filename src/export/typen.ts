import type { Projekt } from '../model/typen';

export interface ExportAuftrag {
  projekt: Projekt;
  art: 'clip' | 'playlist';
  id: string;
  /** Videodatei je Quelle (bei Proxy-Dateien die Proxy-Datei) */
  quellen: Record<string, File>;
  breite: number;
  hoehe: number;
  fps: number;
  bitrate: number;
  videoCodec: 'avc' | 'vp9';
  audioCodec: 'aac' | 'opus' | null;
  /** Fertig gemischter Ton (planare Kanäle, Float32) */
  audio: { sampleRate: number; kanaele: Float32Array[] } | null;
  logo: { bild: ImageBitmap; breite: number; hoehe: number } | null;
  /** Direkt in eine Datei schreiben; `null` = im Speicher sammeln */
  ziel: WritableStream | null;
}

export type WorkerNachricht =
  | { typ: 'fortschritt'; bild: number; gesamt: number }
  | { typ: 'fertig'; buffer: ArrayBuffer | null; mime: string }
  | { typ: 'abgebrochen' }
  | { typ: 'fehler'; meldung: string };

export type WorkerBefehl = { typ: 'start'; auftrag: ExportAuftrag } | { typ: 'abbruch' };
