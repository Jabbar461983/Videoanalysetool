import { neueId } from '../model/schema';
import type {
  Clip,
  Situation,
  TafelAnzeige,
  TaktikAbschnitt,
  TaktikMarker,
  TaktikPfeil,
} from '../model/typen';

export const STANDARD_ANZEIGE: TafelAnzeige = { modus: 'pip', ecke: 'ur', groesse: 0.3 };

const rund = (v: number) => Math.round(v * 1000) / 1000;

export function abschnittBei(clip: Pick<Clip, 'taktik'>, t: number): TaktikAbschnitt | undefined {
  return clip.taktik?.abschnitte.find((a) => t >= a.start - 1e-9 && t < a.ende);
}

/** Fügt einen Abschnitt hinzu (mindestens 0.2 s); überlappende ältere werden gekürzt oder entfernt. */
export function fuegeAbschnittHinzu(
  clip: Clip,
  start: number,
  ende: number,
  situationId?: string,
  nachSituationId?: string,
): TaktikAbschnitt | null {
  if (!(ende - start >= 0.2)) return null;
  clip.taktik ??= { anzeige: { ...STANDARD_ANZEIGE }, abschnitte: [] };
  const rest: TaktikAbschnitt[] = [];
  for (const a of clip.taktik.abschnitte) {
    if (a.ende <= start + 1e-9 || a.start >= ende - 1e-9) rest.push(a);
    else {
      if (a.start < start - 0.2) rest.push({ ...a, ende: rund(start) });
      if (a.ende > ende + 0.2) rest.push({ ...a, id: neueId(), start: rund(ende) });
    }
  }
  const neu: TaktikAbschnitt = {
    id: neueId(),
    start: rund(start),
    ende: rund(ende),
    situationId,
    nachSituationId,
  };
  rest.push(neu);
  rest.sort((x, y) => x.start - y.start);
  clip.taktik.abschnitte = rest;
  return neu;
}

export function entferneAbschnitt(clip: Clip, id: string): void {
  if (clip.taktik) clip.taktik.abschnitte = clip.taktik.abschnitte.filter((a) => a.id !== id);
}

/** Hotkey T: Liegt `t` in einem Abschnitt, wird er entfernt; sonst entsteht einer ab `t` (Standard 8 s, höchstens bis `dauer`). */
export function schalteTafelBei(
  clip: Clip,
  t: number,
  dauer: number,
  situationId?: string,
  laenge = 8,
): 'entfernt' | 'hinzugefuegt' | null {
  const a = abschnittBei(clip, t);
  if (a) {
    entferneAbschnitt(clip, a.id);
    return 'entfernt';
  }
  const ende = Math.min(dauer, t + laenge);
  return fuegeAbschnittHinzu(clip, t, ende > t + 0.2 ? ende : dauer, situationId)
    ? 'hinzugefuegt'
    : null;
}

export function neueSituation(
  name: string,
  marker: TaktikMarker[] = [],
  pfeile: TaktikPfeil[] = [],
): Situation {
  return { id: neueId(), name, marker, pfeile, erstelltAm: Date.now() };
}

/** Kopie mit neuer Id; die Marker-Ids bleiben gleich, damit die Marker zwischen Original und Kopie gleiten können. */
export function dupliziereSituation(s: Situation, name = `${s.name} (Kopie)`): Situation {
  return {
    ...s,
    id: neueId(),
    name,
    erstelltAm: Date.now(),
    marker: s.marker.map((m) => ({ ...m })),
    pfeile: s.pfeile.map((p) => ({ ...p, id: neueId(), von: { ...p.von }, nach: { ...p.nach } })),
  };
}

export const neuerMarker = (
  art: TaktikMarker['art'],
  x: number,
  y: number,
  nummer?: number,
): TaktikMarker => ({
  id: neueId(),
  art,
  x,
  y,
  ...(nummer !== undefined ? { nummer } : {}),
});

/** Anteil (0–1) der Animation zur Clip-Zeit `t` im Abschnitt: läuft in den ersten 80 %, danach bleibt das Ziel stehen. */
export function animationsAnteil(a: Pick<TaktikAbschnitt, 'start' | 'ende'>, t: number): number {
  const dauer = (a.ende - a.start) * 0.8;
  return dauer <= 0 ? 1 : Math.min(1, Math.max(0, (t - a.start) / dauer));
}

/** Marker auf das Feld begrenzen (mit kleinem Rand). */
export const imFeld = (v: number, max: number): number => Math.min(max + 1, Math.max(-1, v));
