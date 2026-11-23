import { erweitereMaske, fuelleRingweise } from './fuellen';

let worker: Worker | null = null;
let zaehler = 0;
const wartend = new Map<
  number,
  { ok: (d: Uint8ClampedArray) => void; fehler: (e: Error) => void }
>();

function holeWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./inpaint.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ id: number; rgba?: Uint8ClampedArray; fehler?: string }>) => {
    const x = wartend.get(e.data.id);
    wartend.delete(e.data.id);
    if (!x) return;
    if (e.data.rgba) x.ok(e.data.rgba);
    else x.fehler(new Error(e.data.fehler ?? 'Inpainting fehlgeschlagen'));
  };
  w.onerror = () => {
    wartend.forEach((x) => x.fehler(new Error('Der Inpainting-Worker ist abgestürzt.')));
    wartend.clear();
    worker?.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

export interface FuellErgebnis {
  bild: ImageData;
  verfahren: 'opencv-telea' | 'ringweise';
}

/**
 * Füllt die Maskenpixel (0/255) von `bild` mit passendem Hintergrund. Die Maske wird vorher um `rand` Pixel
 * vergrössert (Schatten, Kantensaum). Fällt OpenCV aus, greift die einfache Ringfüllung.
 */
export async function fuelleHintergrund(
  bild: ImageData,
  maske: Uint8Array,
  rand = 4,
): Promise<FuellErgebnis> {
  const m = erweitereMaske(maske, bild.width, bild.height, rand);
  try {
    const kopie = new Uint8ClampedArray(bild.data);
    const id = ++zaehler;
    const rgba = await new Promise<Uint8ClampedArray>((ok, fehler) => {
      wartend.set(id, { ok, fehler });
      holeWorker().postMessage({ id, rgba: kopie, b: bild.width, h: bild.height, maske: m }, [
        kopie.buffer,
      ]);
    });
    return {
      bild: new ImageData(new Uint8ClampedArray(rgba), bild.width, bild.height),
      verfahren: 'opencv-telea',
    };
  } catch {
    const kopie = new Uint8ClampedArray(bild.data);
    fuelleRingweise(kopie, bild.width, bild.height, m);
    return { bild: new ImageData(kopie, bild.width, bild.height), verfahren: 'ringweise' };
  }
}
