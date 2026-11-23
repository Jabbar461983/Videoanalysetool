/** Mikrofon-Zugriff und Aufnahme (getUserMedia + MediaRecorder). */

export interface Mikrofongeraet {
  id: string;
  label: string;
}

export async function listeMikrofone(): Promise<Mikrofongeraet[]> {
  const alle = await navigator.mediaDevices.enumerateDevices();
  return alle
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Mikrofon ${i + 1}` }));
}

const MIME_KANDIDATEN = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];
export const waehleMime = (): string | undefined =>
  typeof MediaRecorder === 'undefined'
    ? undefined
    : MIME_KANDIDATEN.find((m) => MediaRecorder.isTypeSupported(m));

export class Mikrofon {
  private recorder: MediaRecorder | null = null;
  private stuecke: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private daten: Uint8Array<ArrayBuffer> | null = null;
  private beginn = 0;

  private constructor(readonly stream: MediaStream) {}

  static async oeffne(geraetId?: string): Promise<Mikrofon> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(geraetId ? { deviceId: { exact: geraetId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    const m = new Mikrofon(stream);
    m.ctx = new AudioContext();
    m.analyser = m.ctx.createAnalyser();
    m.analyser.fftSize = 1024;
    m.daten = new Uint8Array(m.analyser.fftSize);
    m.ctx.createMediaStreamSource(stream).connect(m.analyser);
    return m;
  }

  get geraetId(): string | undefined {
    return this.stream.getAudioTracks()[0]?.getSettings().deviceId;
  }

  /** Aktueller Pegel 0–1 (Spitze der letzten ~20 ms). */
  pegel(): number {
    if (!this.analyser || !this.daten) return 0;
    this.analyser.getByteTimeDomainData(this.daten);
    let m = 0;
    for (const v of this.daten) m = Math.max(m, Math.abs(v - 128) / 128);
    return Math.min(1, m);
  }

  beginne(): string {
    const mime = waehleMime();
    this.stuecke = [];
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.stuecke.push(e.data);
    };
    this.beginn = performance.now();
    this.recorder.start(250); // Stückweise, damit bei Absturz höchstens Sekunden fehlen
    return this.recorder.mimeType || mime || 'audio/webm';
  }

  stoppe(): Promise<{ blob: Blob; mime: string; dauerMs: number }> {
    return new Promise((resolve, reject) => {
      const r = this.recorder;
      if (!r || r.state === 'inactive') return reject(new Error('Keine Aufnahme läuft'));
      r.onstop = () =>
        resolve({
          blob: new Blob(this.stuecke, { type: r.mimeType }),
          mime: r.mimeType,
          dauerMs: performance.now() - this.beginn,
        });
      r.onerror = () => reject(new Error('Aufnahmefehler'));
      r.stop();
    });
  }

  get nimmtAuf(): boolean {
    return this.recorder?.state === 'recording';
  }

  schliesse(): void {
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
  }
}
