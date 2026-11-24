import type { SerializedDockview } from 'dockview-react';
import { istGueltig } from './standard';

const KEY = 'bdva-layout-v1';

/** Zuletzt benutztes Layout dieses Geräts (nicht im Projekt). Ungültiges oder fehlendes → `null` (dann Standard). */
export function ladeLayout(): SerializedDockview | null {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const json = JSON.parse(roh) as unknown;
    return istGueltig(json) ? (json as SerializedDockview) : null;
  } catch {
    return null;
  }
}

export function speichereLayout(json: SerializedDockview): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(json));
  } catch {
    /* Speicher voll oder gesperrt: Layout bleibt nur für diese Sitzung */
  }
}

export function loescheLayout(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* egal */
  }
}
