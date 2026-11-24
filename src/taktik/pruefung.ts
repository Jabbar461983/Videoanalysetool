import { neueId } from '../model/schema';
import type { FeldMasse, TaktikMarker } from '../model/typen';
import type { Pt } from './homographie';
import { MIN_MARKER_ABSTAND, imFeldBereich, type BildBox } from './uebernehmen';

/** So viele Spieler sind höchstens zu erwarten: 2 × (5 Feldspieler + Torhüter). */
export const MAX_SPIELER = 12;

/** Eine erkannte Person im Prüfdialog. */
export interface Person {
  box: BildBox;
  /** Fusspunkt auf dem Feld in Metern (null, wenn nicht projizierbar) */
  feld: Pt | null;
  imFeld: boolean;
  /** Mannschaft (0 = Team 1, 1 = Team 2) – gilt, wenn `an` */
  team: 0 | 1;
  /** Wird in die Situation übernommen? */
  an: boolean;
  /** Warum standardmässig nicht übernommen */
  grund?: 'ausserhalb' | 'doppelt' | 'zuViele';
}

/**
 * Erste Auswahl: Personen im Feld sind «an»; zwei Personen näher als 0.7 m gelten als eine (die sicherere bleibt),
 * und von mehr als `max` Personen bleiben nur die sichersten.
 */
export function baueAuswahl(
  boxen: BildBox[],
  feldPositionen: (Pt | null)[],
  teams: number[] | null,
  feld: FeldMasse,
  max = MAX_SPIELER,
): { personen: Person[]; gekappt: number; doppelt: number; ausserhalb: number } {
  const personen: Person[] = boxen.map((box, i) => {
    const f = feldPositionen[i] ?? null;
    const im = !!f && imFeldBereich(f, feld, feld.erkennungsRand);
    return {
      box,
      feld: f,
      imFeld: im,
      team: teams?.[i] === 1 ? 1 : 0,
      an: im,
      grund: im ? undefined : 'ausserhalb',
    };
  });
  const nachScore = personen
    .map((_, i) => i)
    .sort((a, b) => personen[b]!.box.score - personen[a]!.box.score);
  const behalten: number[] = [];
  let doppelt = 0;
  for (const i of nachScore) {
    const p = personen[i]!;
    if (!p.an) continue;
    const zuNah = behalten.some((k) => {
      const q = personen[k]!;
      return Math.hypot(q.feld!.x - p.feld!.x, q.feld!.y - p.feld!.y) < MIN_MARKER_ABSTAND;
    });
    if (zuNah) {
      p.an = false;
      p.grund = 'doppelt';
      doppelt++;
    } else behalten.push(i);
  }
  let gekappt = 0;
  behalten.forEach((i, rang) => {
    if (rang >= max) {
      personen[i]!.an = false;
      personen[i]!.grund = 'zuViele';
      gekappt++;
    }
  });
  return {
    personen,
    gekappt,
    doppelt,
    ausserhalb: personen.filter((p) => p.grund === 'ausserhalb').length,
  };
}

/** Klick auf eine Person: Team 1 → Team 2 → nicht übernehmen → Team 1. */
export function naechsterZustand(p: Person): Person {
  if (!p.an) return { ...p, an: true, team: 0, grund: undefined };
  if (p.team === 0) return { ...p, team: 1 };
  return { ...p, an: false };
}

/** Alle Teams vertauschen (nur übernommene Personen sind betroffen). */
export const tauscheTeams = (liste: Person[]): Person[] =>
  liste.map((p) => (p.an ? { ...p, team: p.team === 0 ? 1 : 0 } : p));

/** Zählung für die Anzeige. */
export function zaehle(liste: Person[]): { team1: number; team2: number; aus: number } {
  return {
    team1: liste.filter((p) => p.an && p.team === 0).length,
    team2: liste.filter((p) => p.an && p.team === 1).length,
    aus: liste.filter((p) => !p.an).length,
  };
}

/** Feldmarker aus den übernommenen Personen (Position auf dem Feld begrenzt). */
export function markerAusPersonen(liste: Person[], feld: FeldMasse): TaktikMarker[] {
  return liste
    .filter((p) => p.an && p.feld)
    .map((p) => ({
      id: neueId(),
      art: p.team === 1 ? ('team2' as const) : ('team1' as const),
      x: Math.min(feld.laenge, Math.max(0, p.feld!.x)),
      y: Math.min(feld.breite, Math.max(0, p.feld!.y)),
    }));
}
