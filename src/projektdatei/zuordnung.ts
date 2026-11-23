import type { Quelle } from '../model/typen';
import { pruefeDatei, type Treffer } from '../video/quelle';

export interface Zuordnung {
  quelleId: string;
  datei: File;
  /** gleich = Name, Grösse und Teil-Hash stimmen; aehnlich = Inhalt gleich, Name anders */
  treffer: Exclude<Treffer, 'anders'>;
}

/**
 * Ordnet gewählte Videodateien den fehlenden Quellen zu (Dateiname, Grösse, Teil-Hash).
 * Eine Datei passt zu höchstens einer Quelle; die genauere Übereinstimmung (gleicher Name) gewinnt.
 */
export async function ordneDateienZu(
  fehlend: Pick<Quelle, 'id' | 'dateiname' | 'groesse' | 'teilHash'>[],
  dateien: File[],
): Promise<{ zugeordnet: Zuordnung[]; uebrig: File[]; ohneDatei: string[] }> {
  const zugeordnet: Zuordnung[] = [];
  const verwendet = new Set<File>();
  const offen = [...fehlend];
  for (const q of [...fehlend].sort((a, b) => a.dateiname.localeCompare(b.dateiname))) {
    let beste: { datei: File; treffer: Zuordnung['treffer'] } | null = null;
    for (const d of dateien) {
      if (verwendet.has(d) || d.size !== q.groesse) continue;
      const t = await pruefeDatei(q, d);
      if (t === 'anders') continue;
      if (!beste || (t === 'gleich' && beste.treffer !== 'gleich'))
        beste = { datei: d, treffer: t };
    }
    if (beste) {
      verwendet.add(beste.datei);
      zugeordnet.push({ quelleId: q.id, datei: beste.datei, treffer: beste.treffer });
      offen.splice(
        offen.findIndex((x) => x.id === q.id),
        1,
      );
    }
  }
  return {
    zugeordnet,
    uebrig: dateien.filter((d) => !verwendet.has(d)),
    ohneDatei: offen.map((q) => q.id),
  };
}
