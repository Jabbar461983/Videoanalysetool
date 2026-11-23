import { holeModell, STANDARD_SAM, type SamModellInfo } from './modelle';
import type { KiAntwort, KiBefehl, KlickPunkt } from './typen';

export interface Ladestand {
  status: 'leer' | 'laedt' | 'bereit' | 'fehler';
  modell?: SamModellInfo;
  prozent: number;
  geraet?: 'webgpu' | 'wasm';
  meldung?: string;
}

export interface MaskenErgebnis {
  maske: Uint8Array;
  breite: number;
  hoehe: number;
  score: number;
  ms: number;
}

/** Client für den KI-Worker: lädt das Modell erst beim ersten Gebrauch. Je Instanz ein Worker. */
export class SamClient {
  private worker: Worker | null = null;
  private zaehler = 0;
  private wartend = new Map<number, { ok: (a: KiAntwort) => void; fehler: (e: Error) => void }>();
  private initWarten: {
    ok: (a: Extract<KiAntwort, { typ: 'bereit' }>) => void;
    fehler: (e: Error) => void;
  } | null = null;
  stand: Ladestand = { status: 'leer', prozent: 0 };
  private hoerer = new Set<(s: Ladestand) => void>();
  private dateiProzent = new Map<string, { geladen: number; gesamt: number }>();

  beiStand(f: (s: Ladestand) => void): () => void {
    this.hoerer.add(f);
    return () => this.hoerer.delete(f);
  }
  private setze(patch: Partial<Ladestand>) {
    this.stand = { ...this.stand, ...patch };
    this.hoerer.forEach((f) => f(this.stand));
  }

  private starte(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./sam.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<KiAntwort>) => {
      const a = e.data;
      if (a.typ === 'fortschritt') {
        this.dateiProzent.set(a.datei, { geladen: a.geladen, gesamt: a.gesamt });
        let g = 0;
        let t = 0;
        for (const v of this.dateiProzent.values()) {
          g += v.geladen;
          t += v.gesamt;
        }
        this.setze({ prozent: t ? Math.round((g / t) * 100) : 0 });
      } else if (a.typ === 'bereit') {
        this.setze({ status: 'bereit', prozent: 100, geraet: a.geraet });
        this.initWarten?.ok(a);
        this.initWarten = null;
      } else if (a.typ === 'fehler') {
        const err = new Error(a.meldung);
        if (a.id !== undefined) this.wartend.get(a.id)?.fehler(err);
        else if (this.initWarten) {
          this.setze({ status: 'fehler', meldung: a.meldung });
          this.initWarten.fehler(err);
          this.initWarten = null;
        }
        if (a.id !== undefined) this.wartend.delete(a.id);
      } else {
        this.wartend.get(a.id)?.ok(a);
        this.wartend.delete(a.id);
      }
    };
    w.onerror = (e) => {
      const err = new Error(e.message || 'Der KI-Worker ist abgestürzt.');
      this.setze({ status: 'fehler', meldung: err.message });
      this.initWarten?.fehler(err);
      this.initWarten = null;
      this.wartend.forEach((x) => x.fehler(err));
      this.wartend.clear();
    };
    this.worker = w;
    return w;
  }

  private sende(b: KiBefehl, transfer: Transferable[] = []) {
    this.starte().postMessage(b, transfer);
  }

  /** Lädt das Modell (einmalig je Modell). */
  async lade(
    modellId: string = STANDARD_SAM,
    geraet: 'auto' | 'wasm' | 'webgpu' = 'auto',
  ): Promise<Ladestand> {
    try {
      return await this.ladeEinmal(modellId, geraet);
    } catch (e) {
      if (geraet === 'wasm') throw e;
      // Scheitert WebGPU, bleibt die Laufzeit im Worker oft in einem kaputten Zustand: sauber neu starten, nur CPU.
      const erster = e instanceof Error ? e.message : String(e);
      this.beende();
      try {
        return await this.ladeEinmal(modellId, 'wasm');
      } catch (e2) {
        const zweiter = e2 instanceof Error ? e2.message : String(e2);
        throw new Error(`WebGPU: ${erster} | CPU: ${zweiter}`, { cause: e2 });
      }
    }
  }

  private async ladeEinmal(
    modellId: string,
    geraet: 'auto' | 'wasm' | 'webgpu',
  ): Promise<Ladestand> {
    const modell = holeModell(modellId);
    if (this.stand.status === 'bereit' && this.stand.modell?.id === modell.id) return this.stand;
    if (this.stand.status === 'laedt') throw new Error('Das Modell lädt bereits.');
    this.dateiProzent.clear();
    this.setze({ status: 'laedt', modell, prozent: 0, meldung: undefined });
    await new Promise<unknown>((ok, fehler) => {
      this.initWarten = { ok, fehler };
      this.sende({ typ: 'init', modell, geraet });
    });
    return this.stand;
  }

  private anfrage<T extends KiAntwort>(
    erzeuge: (id: number) => KiBefehl,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const id = ++this.zaehler;
    return new Promise<T>((ok, fehler) => {
      this.wartend.set(id, { ok: ok as (a: KiAntwort) => void, fehler });
      this.sende(erzeuge(id), transfer);
    });
  }

  /** Bild (Ausschnitt) für die folgenden Masken berechnen. */
  async einbetten(bild: ImageBitmap): Promise<number> {
    const a = await this.anfrage<Extract<KiAntwort, { typ: 'eingebettet' }>>(
      (id) => ({ typ: 'einbetten', id, bild }),
      [bild],
    );
    return a.ms;
  }

  async maske(punkte: KlickPunkt[]): Promise<MaskenErgebnis> {
    const a = await this.anfrage<Extract<KiAntwort, { typ: 'maske' }>>((id) => ({
      typ: 'maske',
      id,
      punkte,
    }));
    return { maske: a.maske, breite: a.breite, hoehe: a.hoehe, score: a.score, ms: a.ms };
  }

  beende(): void {
    this.worker?.terminate();
    this.worker = null;
    this.initWarten = null;
    this.wartend.clear();
    this.dateiProzent.clear();
    this.setze({ status: 'leer', prozent: 0, modell: undefined });
  }
}

/** Gemeinsamer Client der Anwendung (Clip-Editor); der Benchmark erzeugt eigene Instanzen. */
export const sam = new SamClient();
