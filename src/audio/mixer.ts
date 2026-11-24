import { audioPlan, gainBei, type AudioPlan } from './plan';
import { holeBuffer } from './speicher';
import type { Projekt } from '../model/typen';
import type { Zeitplan } from '../wiedergabe/zeitachse';

const AUSGABE_KEY = 'bdva-audio-ausgabe';
function leseAusgabe(): string {
  try {
    return localStorage.getItem(AUSGABE_KEY) ?? '';
  } catch {
    return '';
  }
}
function merkeAusgabe(id: string): void {
  try {
    if (id) localStorage.setItem(AUSGABE_KEY, id);
    else localStorage.removeItem(AUSGABE_KEY);
  } catch {
    /* egal */
  }
}
export const ausgabeWaehlbar = (): boolean =>
  typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;

/** Abweichung (s), ab der Kommentar-Ton und Video neu synchronisiert werden. */
export const SYNC_TOLERANZ = 0.12;
const SYNC_PAUSE_MS = 600;

/**
 * Vorschau-Mixer (Web Audio): beide Video-Elemente laufen über einen gemeinsamen Gain (Originalton,
 * mit Stumm/Solo/Lautstärke/Ducking als Kurve); Kommentare werden als Pufferquellen zeitgenau geplant.
 * Planung kommt aus `audioPlan` (dieselbe wie beim Mixdown für den Export).
 */
export class Mixer {
  private ctx: AudioContext | null = null;
  private orig: GainNode | null = null;
  private verbunden = new WeakSet<HTMLMediaElement>();
  private quellen = new Set<AudioBufferSourceNode>();
  private token = 0;
  private startCtx = 0;
  private startZeit = 0;
  private laeuft = false;
  private letzteSync = 0;

  constructor(
    private holePlan: () => { plan: Zeitplan; projekt: Projekt } | null,
    private holePuffer: (id: string) => Promise<AudioBuffer | null> = holeBuffer,
  ) {}

  private init(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.orig = this.ctx.createGain();
      this.orig.connect(this.ctx.destination);
      const gemerkt = leseAusgabe();
      if (gemerkt) void this.setzeAusgabe(gemerkt, false);
    }
    return this.ctx;
  }

  /** Wählbares Ausgabegerät (nur Chrome/Edge). `''` = Standardgerät. */
  async setzeAusgabe(deviceId: string, merken = true): Promise<boolean> {
    const ctx = this.ctx ?? this.init();
    const c = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (typeof c.setSinkId !== 'function') return false;
    try {
      await c.setSinkId(deviceId);
      if (merken) merkeAusgabe(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  /** Video-Elemente in den Graphen hängen (einmalig; danach läuft ihr Ton immer über den Mixer). */
  verbinde(...els: HTMLMediaElement[]): void {
    const ctx = this.init();
    for (const el of els) {
      if (this.verbunden.has(el)) continue;
      try {
        ctx.createMediaElementSource(el).connect(this.orig!);
        this.verbunden.add(el);
      } catch {
        /* bereits an einen anderen Kontext gebunden */
      }
    }
  }

  async resume(): Promise<void> {
    const ctx = this.init();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  }

  get kontext(): AudioContext | null {
    return this.ctx;
  }

  /** Quell-Ansicht: Originalton unverändert (Gain 1), keine Kommentare. */
  quellModus(): void {
    this.steht();
    if (this.ctx && this.orig) {
      this.orig.gain.cancelScheduledValues(0);
      this.orig.gain.setValueAtTime(1, this.ctx.currentTime);
    }
  }

  private stoppeQuellen(): void {
    for (const q of this.quellen) {
      try {
        q.stop();
      } catch {
        /* schon beendet */
      }
    }
    this.quellen.clear();
  }

  /** Wiedergabe beginnt (oder springt) bei Programmzeit `zeit`: Gain-Kurve und Kommentare neu planen. */
  async spielt(zeit: number): Promise<void> {
    const ctx = this.init();
    const tok = ++this.token;
    this.stoppeQuellen();
    await this.resume();
    const h = this.holePlan();
    if (!h || tok !== this.token) return;
    const ap: AudioPlan = audioPlan(h.plan, h.projekt);
    this.startCtx = ctx.currentTime;
    this.startZeit = zeit;
    this.laeuft = true;
    this.letzteSync = performance.now();

    const g = this.orig!.gain;
    g.cancelScheduledValues(0);
    g.setValueAtTime(gainBei(ap.original, zeit), this.startCtx);
    for (const p of ap.original) {
      if (p.t > zeit) g.linearRampToValueAtTime(p.gain, this.startCtx + (p.t - zeit));
    }

    const ereignisse = ap.ereignisse.filter((e) => e.start + e.dauer > zeit + 0.01);
    const puffer = await Promise.all(ereignisse.map((e) => this.holePuffer(e.blobId)));
    if (tok !== this.token) return;
    const jetzt = this.startZeit + (ctx.currentTime - this.startCtx); // Ladezeit ausgleichen
    ereignisse.forEach((e, i) => {
      const buf = puffer[i];
      if (!buf) return;
      const spaet = Math.max(0, jetzt - e.start);
      const rest = e.dauer - spaet;
      if (rest <= 0.01) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = e.gain;
      src.connect(gain).connect(ctx.destination);
      src.onended = () => this.quellen.delete(src);
      src.start(ctx.currentTime + Math.max(0, e.start - jetzt), e.offset + spaet, rest);
      this.quellen.add(src);
    });
  }

  /** Wiedergabe angehalten: Kommentare stoppen. */
  steht(): void {
    this.token++;
    this.laeuft = false;
    this.stoppeQuellen();
  }

  /** Aus dem Takt des Programmspielers aufgerufen: bei Drift neu synchronisieren. */
  takt(zeit: number): void {
    if (!this.laeuft || !this.ctx) return;
    const erwartet = this.startZeit + (this.ctx.currentTime - this.startCtx);
    if (
      Math.abs(zeit - erwartet) > SYNC_TOLERANZ &&
      performance.now() - this.letzteSync > SYNC_PAUSE_MS
    ) {
      void this.spielt(zeit);
    }
  }

  get aktiv(): boolean {
    return this.laeuft;
  }
}
