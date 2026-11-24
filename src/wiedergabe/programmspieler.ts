import { usePlayer } from '../store/player';
import { vergleichHaelften } from '../render/vergleich';
import type { PlaylistEintrag } from '../model/typen';
import {
  anordnungVon,
  findeSegmentIndex,
  mischungVon,
  seiteHoerbar,
  type Segment,
  type SeitenZustand,
  type Zeitplan,
} from './zeitachse';

type VergleichEintrag = Extract<PlaylistEintrag, { typ: 'vergleich' }>;

type Slot = 0 | 1;

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function einmal(v: HTMLVideoElement, ereignis: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const ende = (ok: boolean) => {
      v.removeEventListener(ereignis, onOk);
      v.removeEventListener('error', onErr);
      clearTimeout(tm);
      resolve(ok);
    };
    const onOk = () => ende(true);
    const onErr = () => ende(false);
    const tm = setTimeout(() => ende(false), timeoutMs);
    v.addEventListener(ereignis, onOk, { once: true });
    v.addEventListener('error', onErr, { once: true });
  });
}

function bildBereit(v: HTMLVideoElement): Promise<void> {
  if (typeof v.requestVideoFrameCallback !== 'function') return warte(60);
  return Promise.race([
    new Promise<void>((r) => v.requestVideoFrameCallback(() => r())),
    warte(250),
  ]);
}

/**
 * Spielt Clips und Playlists nahtlos ab. Zwei <video>-Elemente (Doppelpuffer): Das nächste
 * Segment wird auf dem versteckten Element vorbereitet (Quelle laden, Position anfahren) und am
 * Übergang nur sichtbar geschaltet. Standbilder und Titelfolien laufen auf einer virtuellen Uhr.
 */
export interface AudioHaken {
  /** Wiedergabe läuft ab Programmzeit `zeit` (Start oder Sprung) */
  spielt(zeit: number): void;
  steht(): void;
  takt(zeit: number): void;
}

export class Programmspieler {
  /** Optionaler Ton-Mixer (Kommentare, Ducking) */
  audio: AudioHaken | null = null;
  private letzterAudioTakt = 0;
  private els: [HTMLVideoElement, HTMLVideoElement] | null = null;
  private aktiv: Slot = 0;
  private plan: Zeitplan | null = null;
  private segIdx = -1;
  private spielt = false;
  private zeit = 0;
  private uhrStart = 0;
  private uhrBasis = 0;
  private raf = 0;
  private token = 0;
  private wechselt = false;
  private bereit: { idx: number; slot: Slot; fertig: Promise<boolean> } | null = null;

  constructor(
    private urlFuer: (quelleId: string) => string | undefined,
    private beiSegment: (seg: Segment | undefined) => void = () => {},
    private beiFehler: (meldung: string) => void = () => {},
  ) {}

  attach(a: HTMLVideoElement, b: HTMLVideoElement): void {
    this.els = [a, b];
    this.aktiv = 0;
    this.zeigeNur(0);
  }
  detach(): void {
    this.stoppe();
    this.els = null;
    this.plan = null;
  }

  /** Beide Videoelemente (links/rechts im Vergleich) */
  get elemente(): [HTMLVideoElement, HTMLVideoElement] | null {
    return this.els;
  }
  get aktivesElement(): HTMLVideoElement | null {
    return this.els?.[this.aktiv] ?? null;
  }
  get dauer(): number {
    return this.plan?.dauer ?? 0;
  }
  get position(): number {
    return this.zeit;
  }
  get laeuft(): boolean {
    return this.spielt;
  }
  get aktuellesSegment(): Segment | undefined {
    return this.plan?.segmente[this.segIdx];
  }

  private zeigeNur(slot: Slot): void {
    if (!this.els) return;
    this.els.forEach((v, i) => {
      v.style.opacity = i === slot ? '1' : '0';
      v.style.zIndex = i === slot ? '1' : '0';
      v.style.left = '';
      v.style.top = '';
      v.style.right = '';
      v.style.bottom = '';
      v.style.width = '';
      v.style.height = '';
      v.style.objectFit = '';
      v.muted = false;
    });
  }

  /** Vergleich: beide Elemente sichtbar, nebeneinander/übereinander/überblendet (gleiche Geometrie wie im Export). */
  private zeigeVergleich(e: VergleichEintrag): void {
    if (!this.els) return;
    const an = anordnungVon(e);
    const g = vergleichHaelften(10000, 10000, an);
    [g.links, g.rechts].forEach((r, i) => {
      const v = this.els![i]!;
      v.style.opacity = i === 1 && an === 'ueberblendet' ? String(mischungVon(e)) : '1';
      v.style.zIndex = String(i + 1);
      v.style.left = `${r.x / 100}%`;
      v.style.top = `${r.y / 100}%`;
      v.style.right = 'auto';
      v.style.bottom = 'auto';
      v.style.width = `${r.b / 100}%`;
      v.style.height = `${r.h / 100}%`;
      v.style.objectFit = e.darstellung === 'fuellen' ? 'cover' : 'contain';
    });
  }

  private veroeffentliche(): void {
    const p = usePlayer.getState();
    p.setZeit(this.zeit);
    p.setSpielt(this.spielt);
  }

  /** Programm laden und an Position `start` bereitstellen (angehalten). */
  async laden(plan: Zeitplan, start = 0): Promise<void> {
    this.stoppe();
    this.plan = plan;
    await this.springe(start);
  }

  /** Plan austauschen (z. B. nach Bearbeitung), Position bleibt. Läuft das Programm, wird angehalten. */
  async aktualisiere(plan: Zeitplan): Promise<void> {
    const t = Math.min(this.zeit, plan.dauer);
    this.stoppe();
    this.plan = plan;
    await this.springe(t);
  }

  private stoppe(): void {
    this.audio?.steht();
    this.spielt = false;
    cancelAnimationFrame(this.raf);
    this.token++;
    this.bereit = null;
    this.els?.forEach((v) => v.pause());
    this.veroeffentliche();
  }

  async springe(t: number): Promise<void> {
    const plan = this.plan;
    if (!plan || plan.segmente.length === 0) return;
    this.zeit = Math.min(Math.max(0, t), plan.dauer);
    const idx = findeSegmentIndex(plan.segmente, this.zeit);
    const seg = plan.segmente[idx]!;
    this.veroeffentliche();
    const tok = ++this.token;
    await this.betrete(idx, Math.min(this.zeit - seg.start, seg.dauer), tok);
    if (this.spielt && tok === this.token) this.audio?.spielt(this.zeit);
  }

  private urlOderFehler(seg: Segment): string | undefined {
    const url = seg.quelleId ? this.urlFuer(seg.quelleId) : undefined;
    if (!url) {
      this.spielt = false;
      cancelAnimationFrame(this.raf);
      this.els?.forEach((v) => v.pause());
      this.beiFehler('Eine Videodatei dieses Programms ist nicht verknüpft.');
      this.veroeffentliche();
    }
    return url;
  }

  private async setzeVideo(
    slot: Slot,
    quelleId: string,
    url: string,
    zeit: number,
  ): Promise<boolean> {
    const v = this.els?.[slot];
    if (!v) return false;
    if (v.dataset.quelle !== quelleId || v.dataset.url !== url) {
      v.dataset.quelle = quelleId;
      v.dataset.url = url;
      v.src = url;
      const ok = await einmal(v, 'loadedmetadata', 10000);
      if (!ok) return false;
    }
    v.pause();
    if (Math.abs(v.currentTime - zeit) > 0.001 || v.seeking) {
      const fertig = einmal(v, 'seeked', 4000);
      v.currentTime = zeit;
      if (!(await fertig)) return false;
    }
    await bildBereit(v);
    return true;
  }

  private bereiteVor(idx: number): void {
    const seg = this.plan?.segmente[idx];
    this.bereit = null;
    if (!seg || seg.art === 'titel' || seg.art === 'vergleich' || !seg.quelleId) return;
    const url = this.urlFuer(seg.quelleId);
    if (!url) return;
    const slot: Slot = this.aktiv === 0 ? 1 : 0;
    const zeit = seg.art === 'freeze' ? seg.zeit! : seg.von!;
    this.bereit = { idx, slot, fertig: this.setzeVideo(slot, seg.quelleId, url, zeit) };
  }

  private async betrete(idx: number, lokal: number, tok: number): Promise<void> {
    const plan = this.plan;
    const seg = plan?.segmente[idx];
    if (!plan || !seg || !this.els) return;
    this.wechselt = true;
    this.segIdx = idx;
    this.beiSegment(seg);
    try {
      if (seg.art === 'titel') {
        this.els.forEach((v) => v.pause());
      } else if (seg.art === 'vergleich') {
        if (!(await this.betreteVergleich(seg, lokal, tok))) return;
      } else {
        const url = this.urlOderFehler(seg);
        if (!url) return;
        const quellZeit = seg.art === 'freeze' ? seg.zeit! : seg.von! + lokal * seg.tempo!;
        let slot = this.aktiv;
        const b = this.bereit;
        if (b && b.idx === idx && lokal < 0.05) {
          slot = b.slot;
          if (!(await b.fertig)) this.beiFehler('Das Video konnte nicht geladen werden.');
        } else if (!(await this.setzeVideo(slot, seg.quelleId!, url, quellZeit))) {
          this.beiFehler('Das Video konnte nicht geladen werden.');
        }
        if (tok !== this.token) return;
        if (slot !== this.aktiv) {
          const alt = this.els[this.aktiv];
          this.aktiv = slot;
          this.zeigeNur(slot);
          alt.pause();
        } else this.zeigeNur(slot);
        const v = this.els[slot];
        v.playbackRate = seg.art === 'video' ? seg.tempo! : 1;
        if (this.spielt && seg.art === 'video') void v.play().catch(() => {});
        else v.pause();
      }
      if (tok !== this.token) return;
      this.uhrBasis = lokal;
      this.uhrStart = performance.now();
      if (seg.art === 'vergleich') this.bereit = null;
      else this.bereiteVor(idx + 1);
    } finally {
      if (tok === this.token) this.wechselt = false;
    }
  }

  /** Vergleich: beide Seiten auf ihre Bilder stellen; nur die laufende Seite spielt, die andere steht. */
  private async betreteVergleich(seg: Segment, lokal: number, tok: number): Promise<boolean> {
    const z = seg.vergleich;
    const els = this.els;
    if (!z || !els) return false;
    const seiten: [SeitenZustand, SeitenZustand] = [z.links, z.rechts];
    for (const sz of seiten) {
      if (!this.urlFuer(sz.quelleId)) {
        this.spielt = false;
        cancelAnimationFrame(this.raf);
        els.forEach((v) => v.pause());
        this.beiFehler('Eine Videodatei dieses Programms ist nicht verknüpft.');
        this.veroeffentliche();
        return false;
      }
    }
    const ziel = (sz: SeitenZustand) => (sz.laeuft ? sz.von + lokal * sz.tempo : sz.zeit);
    const ok = await Promise.all(
      seiten.map(async (sz, i) => {
        const v = els[i]!;
        const url = this.urlFuer(sz.quelleId)!;
        const z0 = ziel(sz);
        // Schon an der richtigen Stelle (z. B. Seite läuft im nächsten Abschnitt weiter): nichts anfassen
        const passt =
          v.dataset.quelle === sz.quelleId &&
          v.dataset.url === url &&
          v.readyState >= 2 &&
          !v.seeking &&
          Math.abs(v.currentTime - z0) < 0.06;
        return passt ? true : this.setzeVideo(i as Slot, sz.quelleId, url, z0);
      }),
    );
    if (tok !== this.token) return false;
    if (ok.includes(false)) this.beiFehler('Das Video konnte nicht geladen werden.');
    this.aktiv = 0;
    this.zeigeVergleich(z.eintrag);
    seiten.forEach((sz, i) => {
      const v = els[i]!;
      v.playbackRate = sz.laeuft ? sz.tempo : 1;
      v.muted = !seiteHoerbar(z.eintrag, i === 0 ? 'links' : 'rechts', sz);
      if (this.spielt && sz.laeuft) void v.play().catch(() => {});
      else v.pause();
    });
    return true;
  }

  /** Läuft im Vergleich eine Seite, ist deren Video die Uhr (links hat Vorrang). */
  private vergleichUhr(seg: Segment): { v: HTMLVideoElement; sz: SeitenZustand } | null {
    const z = seg.vergleich;
    const els = this.els;
    if (!z || !els) return null;
    if (z.links.laeuft) return { v: els[0], sz: z.links };
    if (z.rechts.laeuft) return { v: els[1], sz: z.rechts };
    return null;
  }

  async abspielen(): Promise<void> {
    const plan = this.plan;
    if (!plan || plan.segmente.length === 0 || this.spielt) return;
    // Fehlt die Videodatei des aktuellen Abschnitts, nicht starten (Meldung statt Hängen)
    const aktuell = this.aktuellesSegment;
    if (aktuell && aktuell.art !== 'titel' && !this.urlOderFehler(aktuell)) return;
    if (this.zeit >= plan.dauer - 0.02) await this.springe(0);
    this.spielt = true;
    const seg = this.aktuellesSegment;
    const v = this.els?.[this.aktiv];
    if (seg?.art === 'video' && v) void v.play().catch(() => {});
    if (seg?.art === 'vergleich' && seg.vergleich && this.els) {
      if (seg.vergleich.links.laeuft) void this.els[0].play().catch(() => {});
      if (seg.vergleich.rechts.laeuft) void this.els[1].play().catch(() => {});
    }
    this.uhrBasis = seg ? Math.max(0, this.zeit - seg.start) : 0;
    this.uhrStart = performance.now();
    this.veroeffentliche();
    this.audio?.spielt(this.zeit);
    this.raf = requestAnimationFrame(this.takt);
  }

  pausiere(): void {
    if (!this.spielt) return;
    this.spielt = false;
    cancelAnimationFrame(this.raf);
    this.els?.forEach((v) => v.pause());
    this.audio?.steht();
    this.veroeffentliche();
  }

  umschalten(): void {
    if (this.spielt) this.pausiere();
    else void this.abspielen();
  }

  private takt = (jetzt: number): void => {
    if (!this.spielt) return;
    this.raf = requestAnimationFrame(this.takt);
    const plan = this.plan;
    const seg = this.aktuellesSegment;
    if (!plan || !seg || this.wechselt || !this.els) return;
    let lokal: number;
    let ende: boolean;
    const uhr = seg.art === 'vergleich' ? this.vergleichUhr(seg) : null;
    if (uhr) {
      if (uhr.v.seeking) return;
      lokal = (uhr.v.currentTime - uhr.sz.von) / uhr.sz.tempo;
      ende = uhr.v.currentTime >= uhr.sz.bis - 0.02 || uhr.v.ended;
    } else if (seg.art === 'video') {
      const v = this.els[this.aktiv];
      if (v.seeking) return;
      lokal = (v.currentTime - seg.von!) / seg.tempo!;
      ende = v.currentTime >= seg.bis! - 0.02 || v.ended;
    } else {
      lokal = this.uhrBasis + (jetzt - this.uhrStart) / 1000;
      ende = lokal >= seg.dauer;
    }
    if (ende) {
      if (this.segIdx + 1 >= plan.segmente.length) {
        this.zeit = plan.dauer;
        this.pausiere();
        return;
      }
      const naechste = this.segIdx + 1;
      this.zeit = plan.segmente[naechste]!.start;
      this.veroeffentliche();
      void this.betrete(naechste, 0, ++this.token);
      return;
    }
    this.zeit = seg.start + Math.min(Math.max(0, lokal), seg.dauer);
    this.veroeffentliche();
    if (jetzt - this.letzterAudioTakt > 250) {
      this.letzterAudioTakt = jetzt;
      this.audio?.takt(this.zeit);
    }
  };
}
