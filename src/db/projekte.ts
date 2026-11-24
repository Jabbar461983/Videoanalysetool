import { db } from './db';
import { loescheOpfsVideo } from '../video/linkImport';
import { migriere, neueId } from '../model/schema';
import { neuesProjektMitVorlagen } from './vorlagen';
import type { Projekt, Quelle } from '../model/typen';

/** Stabiler Schlüssel für Handles/Vorschaubilder: gleiche Datei = gleicher Schlüssel, auch in Kopien. */
export const dateiKey = (q: Pick<Quelle, 'groesse' | 'teilHash'>): string =>
  `${q.groesse}:${q.teilHash}`;

export async function listeProjekte(): Promise<Projekt[]> {
  const alle = await db.projekte.orderBy('geaendertAm').reverse().toArray();
  return alle.map((p) => migriere(p));
}
export async function ladeProjekt(id: string): Promise<Projekt | undefined> {
  const p = await db.projekte.get(id);
  return p ? migriere(p) : undefined;
}
export async function speichereProjekt(p: Projekt): Promise<void> {
  await db.projekte.put(p);
}
export async function erstelleProjekt(name: string): Promise<Projekt> {
  const p = await neuesProjektMitVorlagen(name);
  await db.projekte.put(p);
  return p;
}
export async function benenneUm(id: string, name: string): Promise<void> {
  await db.projekte.update(id, { name, geaendertAm: Date.now() });
}
export async function dupliziere(id: string, suffix: string): Promise<Projekt | undefined> {
  const p = await ladeProjekt(id);
  if (!p) return undefined;
  const kopie: Projekt = structuredClone(p);
  kopie.id = neueId();
  kopie.name = p.name + suffix;
  kopie.erstelltAm = kopie.geaendertAm = Date.now();
  await db.projekte.put(kopie);
  return kopie;
}
export async function loescheProjekt(id: string): Promise<void> {
  const p = await db.projekte.get(id);
  const opfsDateien: FileSystemFileHandle[] = [];
  await db.transaction(
    'rw',
    [db.projekte, db.wiederherstellung, db.handles, db.thumbs, db.proxys],
    async () => {
      await db.projekte.delete(id);
      await db.wiederherstellung.delete(id);
      const andere = await db.projekte.toArray();
      for (const q of p?.quellen ?? []) {
        const key = dateiKey(q);
        const geteilt = andere.some((o) => o.quellen.some((x) => dateiKey(x) === key));
        if (!geteilt) {
          const h = await db.handles.get(key);
          if (h) opfsDateien.push(h.handle);
          await db.handles.delete(key);
          await db.thumbs.where('quelleKey').equals(key).delete();
        }
        if (q.proxyId && !andere.some((o) => o.quellen.some((x) => x.proxyId === q.proxyId))) {
          await db.proxys.delete(q.proxyId);
        }
      }
    },
  );
  // Per Link geladene Videos (im Browserspeicher) entfernen, sofern nicht von einem anderen Projekt genutzt
  for (const h of opfsDateien) await loescheOpfsVideo(h).catch(() => undefined);
}
