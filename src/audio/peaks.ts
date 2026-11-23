import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';

export const PEAKS_PRO_SEKUNDE = 100;

/** Maximalbetrag je Zeitfenster (0–1) über alle Kanäle. */
export function berechnePeaks(buffer: AudioBuffer, proSekunde = PEAKS_PRO_SEKUNDE): Float32Array {
  const n = Math.max(1, Math.ceil(buffer.duration * proSekunde));
  const out = new Float32Array(n);
  const fenster = buffer.sampleRate / proSekunde;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let m = out[i]!;
      const a = Math.floor(i * fenster);
      const b = Math.min(d.length, Math.floor((i + 1) * fenster));
      for (let k = a; k < b; k++) {
        const v = Math.abs(d[k]!);
        if (v > m) m = v;
      }
      out[i] = m;
    }
  }
  return out;
}

const cache = new Map<string, Promise<Float32Array | null>>();

/**
 * Wellenform des Originaltons im Bereich `von…bis` (Quellzeit) einer Videodatei.
 * Dekodiert nur diesen Bereich (Mediabunny) und liefert `proSekunde` Spitzen je Quellsekunde.
 */
export function peaksAusQuelle(
  schluessel: string,
  datei: Blob,
  von: number,
  bis: number,
  proSekunde = 50,
): Promise<Float32Array | null> {
  const key = `${schluessel}:${von.toFixed(2)}:${bis.toFixed(2)}`;
  const vorhanden = cache.get(key);
  if (vorhanden) return vorhanden;
  const p = (async () => {
    const input = new Input({ source: new BlobSource(datei), formats: ALL_FORMATS });
    try {
      const spur = await input.getPrimaryAudioTrack();
      if (!spur || !(await spur.canDecode())) return null;
      const n = Math.max(1, Math.ceil((bis - von) * proSekunde));
      const out = new Float32Array(n);
      const sink = new AudioBufferSink(spur);
      for await (const w of sink.buffers(von, bis)) {
        const b = w.buffer;
        for (let c = 0; c < b.numberOfChannels; c++) {
          const d = b.getChannelData(c);
          for (let i = 0; i < d.length; i++) {
            const t = w.timestamp + i / b.sampleRate;
            if (t < von || t >= bis) continue;
            const idx = Math.min(n - 1, Math.floor((t - von) * proSekunde));
            const v = Math.abs(d[i]!);
            if (v > out[idx]!) out[idx] = v;
          }
        }
      }
      return out;
    } catch {
      return null;
    } finally {
      input.dispose();
    }
  })();
  cache.set(key, p);
  return p;
}
