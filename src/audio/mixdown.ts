import type { Projekt } from '../model/typen';
import type { Segment, Zeitplan } from '../wiedergabe/zeitachse';
import { audioPlan } from './plan';

export interface MixdownOptionen {
  sampleRate?: number;
  /** Dekodierter Kommentar-Puffer zu einer Blob-Id */
  ladeBuffer: (blobId: string) => Promise<AudioBuffer | null>;
  /** Originalton eines Video-Segments (Quellzeit `von…bis`); der Export (Etappe 6) liefert ihn aus der Quelldatei. */
  original?: (seg: Segment) => Promise<AudioBuffer | null>;
}

/**
 * Mischt Originalton (Ducking, Stumm, Solo, Lautstärke) und Kommentare eines Programms mit
 * `OfflineAudioContext`. Nutzt dieselbe Planung wie die Vorschau (`audioPlan`). Standbilder haben
 * keinen Originalton, Zeitlupen-Segmente werden mit ihrem Tempo abgespielt.
 */
export async function mixdownRender(
  plan: Zeitplan,
  projekt: Pick<Projekt, 'clips'>,
  opt: MixdownOptionen,
): Promise<AudioBuffer> {
  const sr = opt.sampleRate ?? 48000;
  const laenge = Math.max(1, Math.ceil(plan.dauer * sr));
  const ctx = new OfflineAudioContext(2, laenge, sr);
  const ap = audioPlan(plan, projekt);

  const orig = ctx.createGain();
  orig.connect(ctx.destination);
  const g = orig.gain;
  const k = ap.original;
  if (k.length) {
    g.setValueAtTime(k[0]!.gain, 0);
    for (const p of k) g.linearRampToValueAtTime(p.gain, Math.max(0, p.t));
  }
  if (opt.original) {
    for (const seg of plan.segmente) {
      if (seg.art !== 'video') continue;
      const buf = await opt.original(seg);
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = seg.tempo ?? 1;
      src.connect(orig);
      src.start(seg.start);
      src.stop(seg.start + seg.dauer);
    }
  }
  for (const e of ap.ereignisse) {
    const buf = await opt.ladeBuffer(e.blobId);
    if (!buf) continue;
    const gain = ctx.createGain();
    gain.gain.value = e.gain;
    gain.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(e.start, e.offset, e.dauer);
  }
  return ctx.startRendering();
}
