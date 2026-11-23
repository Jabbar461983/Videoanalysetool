import type { Spieler } from '../model/typen';
import { neueId } from '../model/schema';

export type Position = Spieler['position'];

export function leseRolle(s: string): Position | null {
  const x = s.trim().toLocaleLowerCase('de-CH').replace('ü', 'ue').replace('ä', 'ae');
  if (['verteidiger', 'verteidigung', 'v', 'd', 'def', 'defense', 'defender'].includes(x))
    return 'verteidiger';
  if (
    [
      'stuermer',
      'sturm',
      's',
      'f',
      'angreifer',
      'fwd',
      'forward',
      'center',
      'flügel',
      'fluegel',
    ].includes(x)
  )
    return 'stuermer';
  if (['torhueter', 'torwart', 'tw', 'g', 'goalie', 'goalkeeper', 'tor', 't'].includes(x))
    return 'torhueter';
  return null;
}

/** Zerlegt eine CSV-Zeile mit Anführungszeichen. */
function zeile(z: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '',
    q = false;
  for (let i = 0; i < z.length; i++) {
    const c = z[i]!;
    if (q) {
      if (c === '"' && z[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export interface CsvErgebnis {
  spieler: Spieler[];
  fehler: { zeile: number; grund: string }[];
}

/** Spalten: Nummer;Name;Position. Trennzeichen ; oder , (automatisch), Kopfzeile optional. */
export function parseKaderCsv(text: string): CsvErgebnis {
  const zeilen = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((z) => z.trim() !== '');
  const erste = zeilen[0] ?? '';
  const sep =
    (erste.match(/;/g)?.length ?? 0) >= (erste.match(/,/g)?.length ?? 0) && erste.includes(';')
      ? ';'
      : erste.includes(',')
        ? ','
        : ';';
  const spieler: Spieler[] = [];
  const fehler: CsvErgebnis['fehler'] = [];
  zeilen.forEach((z, i) => {
    const [n = '', name = '', pos = ''] = zeile(z, sep);
    if (i === 0 && !/^\d+$/.test(n)) return; // Kopfzeile
    const nummer = Number(n);
    if (!/^\d{1,3}$/.test(n)) return void fehler.push({ zeile: i + 1, grund: 'Nummer ungültig' });
    if (!name) return void fehler.push({ zeile: i + 1, grund: 'Name fehlt' });
    const position = pos ? leseRolle(pos) : 'stuermer';
    if (!position) return void fehler.push({ zeile: i + 1, grund: `Position «${pos}» unbekannt` });
    if (spieler.some((s) => s.nummer === nummer))
      return void fehler.push({ zeile: i + 1, grund: 'Nummer doppelt' });
    spieler.push({ id: neueId(), nummer, name, position });
  });
  return { spieler, fehler };
}
