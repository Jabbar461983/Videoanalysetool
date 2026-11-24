import type { SerializedDockview } from 'dockview-react';
import { istGueltig } from './standard';

const KEY = 'bdva-layouts-v1';
export const MAX_NAME = 40;

export interface BenanntesLayout {
  name: string;
  json: SerializedDockview;
}

function lies(): BenanntesLayout[] {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return [];
    const liste = JSON.parse(roh) as unknown;
    if (!Array.isArray(liste)) return [];
    return liste.filter(
      (x): x is BenanntesLayout =>
        !!x && typeof x.name === 'string' && x.name.length > 0 && istGueltig(x.json),
    );
  } catch {
    return [];
  }
}

function schreibe(liste: BenanntesLayout[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(liste));
    return true;
  } catch {
    return false;
  }
}

export const ladeBenannte = (): BenanntesLayout[] => lies();

export type NamensFehler = 'leer' | 'zuLang' | 'vergeben' | 'speicher' | 'ungueltig';

const bereinige = (name: string) => name.trim().replace(/\s+/g, ' ');

function pruefeName(name: string, liste: BenanntesLayout[], ausser?: string): NamensFehler | null {
  const n = bereinige(name);
  if (!n) return 'leer';
  if (n.length > MAX_NAME) return 'zuLang';
  if (liste.some((x) => x.name.toLowerCase() === n.toLowerCase() && x.name !== ausser))
    return 'vergeben';
  return null;
}

/** Speichert ein Layout unter einem Namen (Namen sind einmalig, ohne Rücksicht auf Gross-/Kleinschreibung). */
export function speichereBenanntes(
  name: string,
  json: SerializedDockview,
): { ok: true; name: string } | { ok: false; fehler: NamensFehler } {
  if (!istGueltig(json)) return { ok: false, fehler: 'ungueltig' };
  const liste = lies();
  const fehler = pruefeName(name, liste);
  if (fehler) return { ok: false, fehler };
  const n = bereinige(name);
  return schreibe([...liste, { name: n, json }])
    ? { ok: true, name: n }
    : { ok: false, fehler: 'speicher' };
}

/** Überschreibt ein bestehendes Layout mit dem aktuellen Stand. */
export function aktualisiereBenanntes(name: string, json: SerializedDockview): boolean {
  if (!istGueltig(json)) return false;
  const liste = lies();
  if (!liste.some((x) => x.name === name)) return false;
  return schreibe(liste.map((x) => (x.name === name ? { name, json } : x)));
}

export function benenneBenanntesUm(
  alt: string,
  neu: string,
): { ok: true } | { ok: false; fehler: NamensFehler } {
  const liste = lies();
  const fehler = pruefeName(neu, liste, alt);
  if (fehler) return { ok: false, fehler };
  const n = bereinige(neu);
  return schreibe(liste.map((x) => (x.name === alt ? { ...x, name: n } : x)))
    ? { ok: true }
    : { ok: false, fehler: 'speicher' };
}

export function loescheBenanntes(name: string): void {
  schreibe(lies().filter((x) => x.name !== name));
}
