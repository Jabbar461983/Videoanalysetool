import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';

/**
 * Decodiert den Originalton einer Videodatei im Bereich `von…bis` (Quellzeit) in einen AudioBuffer
 * in der Abtastrate der Datei. `null`, wenn die Datei keinen (decodierbaren) Ton hat.
 */
export async function decodiereOriginalton(
  datei: Blob,
  von: number,
  bis: number,
): Promise<AudioBuffer | null> {
  const input = new Input({ source: new BlobSource(datei), formats: ALL_FORMATS });
  try {
    const spur = await input.getPrimaryAudioTrack();
    if (!spur || !(await spur.canDecode())) return null;
    const sr = spur.sampleRate;
    const kanaele = Math.min(2, Math.max(1, spur.numberOfChannels));
    const laenge = Math.max(1, Math.ceil((bis - von) * sr));
    const ziel = new AudioBuffer({ length: laenge, sampleRate: sr, numberOfChannels: kanaele });
    const sink = new AudioBufferSink(spur);
    for await (const w of sink.buffers(von, bis)) {
      const start = Math.round((w.timestamp - von) * sr);
      for (let c = 0; c < kanaele; c++) {
        const quelle = w.buffer.getChannelData(Math.min(c, w.buffer.numberOfChannels - 1));
        const skip = start < 0 ? -start : 0;
        const ab = Math.max(0, start);
        const n = Math.min(quelle.length - skip, laenge - ab);
        if (n > 0) ziel.copyToChannel(quelle.subarray(skip, skip + n), c, ab);
      }
    }
    return ziel;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}
