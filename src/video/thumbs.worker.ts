/// <reference lib="webworker" />
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';

export interface ThumbAuftrag {
  id: number;
  datei: Blob;
  zeiten: number[];
  breite: number;
  qualitaet?: number;
}
export type ThumbAntwort =
  | { id: number; typ: 'bild'; zeit: number; blob: Blob }
  | { id: number; typ: 'fertig' }
  | { id: number; typ: 'fehler'; meldung: string };

const abgebrochen = new Set<number>();

self.onmessage = async (e: MessageEvent<ThumbAuftrag | { abbruch: number }>) => {
  if ('abbruch' in e.data) {
    abgebrochen.add(e.data.abbruch);
    return;
  }
  const { id, datei, zeiten, breite, qualitaet = 0.6 } = e.data;
  const antwort = (a: ThumbAntwort) => (self as unknown as Worker).postMessage(a);
  const input = new Input({ source: new BlobSource(datei), formats: ALL_FORMATS });
  try {
    const spur = await input.getPrimaryVideoTrack();
    if (!spur || !(await spur.canDecode())) throw new Error('nicht decodierbar');
    const sink = new CanvasSink(spur, { width: breite, fit: 'contain' });
    let i = 0;
    for await (const w of sink.canvasesAtTimestamps(zeiten)) {
      if (abgebrochen.has(id)) break;
      const zeit = zeiten[i++] ?? 0;
      if (!w) continue;
      const c = w.canvas as OffscreenCanvas;
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: qualitaet });
      antwort({ id, typ: 'bild', zeit, blob });
    }
    antwort({ id, typ: 'fertig' });
  } catch (err) {
    antwort({ id, typ: 'fehler', meldung: String((err as Error).message ?? err) });
  } finally {
    input.dispose();
    abgebrochen.delete(id);
  }
};
