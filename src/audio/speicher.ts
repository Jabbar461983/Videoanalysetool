import { db, type AudioRow } from '../db/db';
import { neueId } from '../model/schema';
import { berechnePeaks, PEAKS_PRO_SEKUNDE } from './peaks';
import { benutzteBlobIds } from './modell';

let dekodierContext: AudioContext | OfflineAudioContext | null = null;
const dekodiert = new Map<string, Promise<AudioBuffer | null>>();

function dekodierer(): AudioContext | OfflineAudioContext {
  dekodierContext ??= new OfflineAudioContext(1, 1, 48000);
  return dekodierContext;
}

export async function dekodiere(blob: Blob): Promise<AudioBuffer> {
  return dekodierer().decodeAudioData(await blob.arrayBuffer());
}

/** Speichert eine Aufnahme sofort in IndexedDB (mit Länge und Wellenform) und liefert Id und Länge. */
export async function speichereAufnahme(blob: Blob, mime: string): Promise<AudioRow> {
  const buffer = await dekodiere(blob);
  const row: AudioRow = {
    id: neueId(),
    blob,
    mime,
    dauer: buffer.duration,
    peaks: berechnePeaks(buffer, PEAKS_PRO_SEKUNDE),
    erstelltAm: Date.now(),
  };
  await db.audio.put(row);
  dekodiert.set(row.id, Promise.resolve(buffer));
  return row;
}

/** Sichert den rohen Blob, falls die Dekodierung scheitert (Aufnahme geht nie verloren). */
export async function speichereRoh(
  blob: Blob,
  mime: string,
  dauerSchaetzung: number,
): Promise<AudioRow> {
  const row: AudioRow = {
    id: neueId(),
    blob,
    mime,
    dauer: dauerSchaetzung,
    peaks: new Float32Array(Math.ceil(dauerSchaetzung * 10)),
    erstelltAm: Date.now(),
  };
  await db.audio.put(row);
  return row;
}

export const holeAudioRow = (id: string): Promise<AudioRow | undefined> => db.audio.get(id);

/** Dekodierter Puffer einer Aufnahme (gecacht). */
export function holeBuffer(id: string): Promise<AudioBuffer | null> {
  let p = dekodiert.get(id);
  if (!p) {
    p = (async () => {
      const row = await db.audio.get(id);
      if (!row) return null;
      try {
        return await dekodiere(row.blob);
      } catch {
        return null;
      }
    })();
    dekodiert.set(id, p);
  }
  return p;
}

/** Entfernt Aufnahmen, die in keinem gespeicherten Projekt mehr vorkommen. */
export async function raeumeAudioAuf(): Promise<number> {
  const benutzt = new Set<string>();
  for (const p of await db.projekte.toArray())
    for (const id of benutzteBlobIds(p.clips)) benutzt.add(id);
  const alle = await db.audio.toCollection().primaryKeys();
  const weg = alle.filter((id) => !benutzt.has(id));
  await db.audio.bulkDelete(weg);
  weg.forEach((id) => dekodiert.delete(id));
  return weg.length;
}
