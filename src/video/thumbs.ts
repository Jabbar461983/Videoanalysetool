import { db } from '../db/db';
import type { ThumbAntwort } from './thumbs.worker';
import { vorschauZeiten } from './bildmathe';

let worker: Worker | null = null;
let zaehler = 0;

export const THUMB_BREITE = 160;

/** Erzeugt fehlende Vorschaubilder im Worker und legt sie in IndexedDB ab (Cache). */
export async function erzeugeVorschauen(
  key: string,
  datei: Blob,
  dauer: number,
  beiBild: (zeit: number, blob: Blob) => void,
): Promise<{ abbrechen: () => void; fertig: Promise<boolean> }> {
  const zeiten = vorschauZeiten(dauer);
  const vorhanden = await db.thumbs.where('quelleKey').equals(key).toArray();
  const have = new Map(vorhanden.map((t) => [Math.round(t.zeit * 1000), t.blob]));
  for (const t of vorhanden) beiBild(t.zeit, t.blob);
  const fehlend = zeiten.filter((z) => !have.has(Math.round(z * 1000)));
  if (fehlend.length === 0) return { abbrechen: () => {}, fertig: Promise.resolve(true) };

  worker ??= new Worker(new URL('./thumbs.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  const id = ++zaehler;
  let ende!: (ok: boolean) => void;
  const fertig = new Promise<boolean>((r) => (ende = r));
  const onMsg = (e: MessageEvent<ThumbAntwort>) => {
    const a = e.data;
    if (a.id !== id) return;
    if (a.typ === 'bild') {
      beiBild(a.zeit, a.blob);
      void db.thumbs.put({
        key: `${key}:${Math.round(a.zeit * 1000)}`,
        quelleKey: key,
        zeit: a.zeit,
        blob: a.blob,
      });
    } else {
      w.removeEventListener('message', onMsg);
      ende(a.typ === 'fertig');
    }
  };
  w.addEventListener('message', onMsg);
  w.postMessage({ id, datei, zeiten: fehlend, breite: THUMB_BREITE });
  return {
    abbrechen: () => {
      w.postMessage({ abbruch: id });
    },
    fertig,
  };
}

let reihe: Promise<unknown> = Promise.resolve();

/** Ein einzelnes Vorschaubild (z. B. Clip-Anfang), gecacht; Aufträge laufen nacheinander. */
export function holeEinzelbild(
  key: string,
  datei: Blob,
  zeit: number,
  breite = THUMB_BREITE,
): Promise<Blob | null> {
  const lauf = async (): Promise<Blob | null> => {
    const cacheKey = `${key}#c:${Math.round(zeit * 1000)}`;
    const row = await db.thumbs.get(cacheKey);
    if (row) return row.blob;
    worker ??= new Worker(new URL('./thumbs.worker.ts', import.meta.url), { type: 'module' });
    const w = worker;
    const id = ++zaehler;
    const blob = await new Promise<Blob | null>((resolve) => {
      let bild: Blob | null = null;
      const onMsg = (e: MessageEvent<ThumbAntwort>) => {
        const a = e.data;
        if (a.id !== id) return;
        if (a.typ === 'bild') bild = a.blob;
        else {
          w.removeEventListener('message', onMsg);
          resolve(bild);
        }
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ id, datei, zeiten: [zeit], breite });
    });
    if (blob) await db.thumbs.put({ key: cacheKey, quelleKey: `${key}#clip`, zeit, blob });
    return blob;
  };
  const ergebnis = reihe.then(lauf, lauf);
  reihe = ergebnis.catch(() => null);
  return ergebnis.catch(() => null);
}
