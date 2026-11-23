import type { Box } from './tracker';

/** Ein Messpunkt der Spur (Quellzeit in Sekunden, Pixel des Videobilds). */
export interface SpurPunkt {
  zeit: number;
  box: Box;
  konfidenz: number;
  zustand: 'ok' | 'unsicher' | 'verloren';
}

export type TrackingBefehl =
  | {
      typ: 'start';
      datei: Blob;
      /** Quellzeit des Klicks und Startbox (Pixel des Videobilds) */
      startZeit: number;
      startBox: Box;
      /** Zeitspanne der Verfolgung (Quellzeit) */
      von: number;
      bis: number;
      /** Abstand der verarbeiteten Bilder in Sekunden */
      schritt: number;
      geraet: 'auto' | 'wasm' | 'webgpu';
    }
  | { typ: 'abbrechen' }
  | { typ: 'schnelltest'; geraet: 'auto' | 'wasm' | 'webgpu' };

export type TrackingAntwort =
  | { typ: 'fortschritt'; datei: string; geladen: number; gesamt: number }
  | { typ: 'bereit'; geraet: 'webgpu' | 'wasm'; ladeMs: number }
  | { typ: 'lauf'; anteil: number; zeit: number; punkt: SpurPunkt; ms: number }
  | { typ: 'fertig'; punkte: SpurPunkt[]; abgebrochen: boolean; medianMs: number }
  | { typ: 'schnelltest'; medianMs: number; geraet: 'webgpu' | 'wasm' }
  | { typ: 'fehler'; meldung: string };
