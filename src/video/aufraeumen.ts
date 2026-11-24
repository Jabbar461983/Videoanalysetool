import { db } from '../db/db';
import { dateiKey } from '../db/projekte';
import type { Quelle } from '../model/typen';
import { loescheOpfsVideo } from './linkImport';

/**
 * Wird eine Quelle entfernt, deren Videodatei dieses Tool per Link im Browserspeicher angelegt hat, und nutzt
 * kein anderes Projekt dieselbe Datei, wird sie gelöscht (sonst bliebe sie als Speicherfresser liegen).
 * Videos, die der Nutzer selbst ausgewählt hat, werden nie angefasst.
 */
export async function raeumeQuelleAuf(
  q: Pick<Quelle, 'groesse' | 'teilHash'>,
  aktuellesProjektId: string,
  restQuellenImProjekt: Pick<Quelle, 'groesse' | 'teilHash'>[],
): Promise<void> {
  const key = dateiKey(q);
  if (restQuellenImProjekt.some((x) => dateiKey(x) === key)) return;
  const andere = await db.projekte.toArray();
  if (andere.some((p) => p.id !== aktuellesProjektId && p.quellen.some((x) => dateiKey(x) === key)))
    return;
  const row = await db.handles.get(key);
  if (!row) return;
  await loescheOpfsVideo(row.handle);
}
