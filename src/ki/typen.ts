import type { SamModellInfo } from './modelle';

/** Klickpunkt im Ausschnitt-Bild (Pixel); label 1 = «gehört dazu», 0 = «gehört nicht dazu» */
export interface KlickPunkt {
  x: number;
  y: number;
  label: 0 | 1;
}

export type KiBefehl =
  | { typ: 'init'; modell: SamModellInfo; geraet: 'auto' | 'wasm' | 'webgpu' }
  | { typ: 'einbetten'; id: number; bild: ImageBitmap }
  | { typ: 'maske'; id: number; punkte: KlickPunkt[] };

export type KiAntwort =
  | { typ: 'fortschritt'; datei: string; prozent: number; geladen: number; gesamt: number }
  | { typ: 'bereit'; geraet: 'webgpu' | 'wasm'; ladeMs: number }
  | { typ: 'eingebettet'; id: number; ms: number }
  | {
      typ: 'maske';
      id: number;
      maske: Uint8Array;
      breite: number;
      hoehe: number;
      score: number;
      ms: number;
    }
  | { typ: 'fehler'; id?: number; meldung: string };
