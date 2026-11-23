import type { Projekt } from '../model/typen';
import { bildSchluessel, type BilderMap, type BildArt } from './spieler';

async function dekodiere(daten: string): Promise<ImageBitmap> {
  const blob = await (await fetch(daten)).blob();
  return createImageBitmap(blob);
}

/**
 * Lädt/aktualisiert alle Bilder der Spieler-Objekte (optional nur eines Clips) in `cache`.
 * Veraltete Einträge werden freigegeben. Gibt `true` zurück, wenn sich etwas geändert hat.
 */
export async function ladeSpielerBilder(
  projekt: Projekt,
  cache: BilderMap,
  clipId?: string,
): Promise<boolean> {
  const gebraucht = new Map<string, string>();
  for (const o of projekt.spielerObjekte) {
    if (clipId && o.clipId !== clipId) continue;
    o.maskenKeyframes.forEach((kf, i) => {
      const arten: [BildArt, string | undefined][] = [
        ['bild', kf.bild],
        ['ausschnitt', kf.ausschnitt],
        ['hintergrund', kf.hintergrund],
      ];
      for (const [art, d] of arten) if (d) gebraucht.set(bildSchluessel(o.id, i, art, d), d);
    });
  }
  let geaendert = false;
  for (const [schluessel, bild] of cache) {
    if (!gebraucht.has(schluessel) && (!clipId || schluessel.length > 0)) {
      if (!clipId) {
        (bild as ImageBitmap).close?.();
        cache.delete(schluessel);
        geaendert = true;
      }
    }
  }
  const neu = [...gebraucht].filter(([k]) => !cache.has(k));
  const geladen = await Promise.all(
    neu.map(async ([k, d]) => [k, await dekodiere(d).catch(() => null)] as const),
  );
  for (const [k, b] of geladen) {
    if (b) {
      cache.set(k, b);
      geaendert = true;
    }
  }
  return geaendert;
}

/** Gemeinsamer Bilder-Cache von Vorschau, PNG-Export und Testhaken (im Export-Worker ein eigener). */
export const vorschauBilder: BilderMap = new Map();
