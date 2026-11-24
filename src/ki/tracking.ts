import { leseKiGeraet } from './geraet';
import type { Box } from './tracker';
import type { SpurPunkt, TrackingAntwort, TrackingBefehl } from './trackingTypen';

export interface TrackingEreignisse {
  /** Modell-Download */
  beiFortschritt?: (prozent: number) => void;
  beiBereit?: (geraet: 'webgpu' | 'wasm', ladeMs: number) => void;
  /** Ein weiteres Bild verarbeitet (0–1) */
  beiLauf?: (anteil: number, punkt: SpurPunkt) => void;
}

export interface TrackingErgebnis {
  punkte: SpurPunkt[];
  abgebrochen: boolean;
  medianMs: number;
}

/** Client für den Tracking-Worker (ein Worker je Lauf, danach beendet). */
export class TrackingLauf {
  private worker: Worker | null = null;
  private dateiProzent = new Map<string, { geladen: number; gesamt: number }>();
  constructor(private readonly ev: TrackingEreignisse = {}) {}

  private starteWorker(): Worker {
    this.worker ??= new Worker(new URL('./tracking.worker.ts', import.meta.url), {
      type: 'module',
    });
    return this.worker;
  }

  private warte<T extends TrackingAntwort['typ']>(
    befehl: TrackingBefehl,
    ende: T,
  ): Promise<Extract<TrackingAntwort, { typ: T }>> {
    const w = this.starteWorker();
    return new Promise((ok, fehler) => {
      w.onmessage = (e: MessageEvent<TrackingAntwort>) => {
        const a = e.data;
        if (a.typ === 'fortschritt') {
          this.dateiProzent.set(a.datei, { geladen: a.geladen, gesamt: a.gesamt });
          let g = 0;
          let t = 0;
          for (const v of this.dateiProzent.values()) {
            g += v.geladen;
            t += v.gesamt;
          }
          this.ev.beiFortschritt?.(t ? Math.round((g / t) * 100) : 0);
        } else if (a.typ === 'bereit') this.ev.beiBereit?.(a.geraet, a.ladeMs);
        else if (a.typ === 'lauf') this.ev.beiLauf?.(a.anteil, a.punkt);
        else if (a.typ === 'fehler') fehler(new Error(a.meldung));
        else if (a.typ === ende) ok(a as Extract<TrackingAntwort, { typ: T }>);
      };
      w.onerror = (e) => fehler(new Error(e.message || 'Der Tracking-Worker ist abgestürzt.'));
      w.postMessage(befehl);
    });
  }

  /** Misst die Erkennungszeit auf diesem Gerät (nach dem Laden des Modells). */
  async schnelltest(geraet: 'auto' | 'wasm' | 'webgpu' = leseKiGeraet()) {
    try {
      const a = await this.warte({ typ: 'schnelltest', geraet }, 'schnelltest');
      return { medianMs: a.medianMs, geraet: a.geraet, gpuFehler: a.gpuFehler };
    } finally {
      this.beende();
    }
  }

  async verfolge(p: {
    datei: Blob;
    startZeit: number;
    startBox: Box;
    von: number;
    bis: number;
    schritt?: number;
    geraet?: 'auto' | 'wasm' | 'webgpu';
  }): Promise<TrackingErgebnis> {
    try {
      const a = await this.warte(
        {
          typ: 'start',
          datei: p.datei,
          startZeit: p.startZeit,
          startBox: p.startBox,
          von: p.von,
          bis: p.bis,
          schritt: p.schritt ?? 1 / 12,
          geraet: p.geraet ?? leseKiGeraet(),
        },
        'fertig',
      );
      return { punkte: a.punkte, abgebrochen: a.abgebrochen, medianMs: a.medianMs };
    } finally {
      this.beende();
    }
  }

  abbrechen(): void {
    this.worker?.postMessage({ typ: 'abbrechen' } satisfies TrackingBefehl);
  }

  beende(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
