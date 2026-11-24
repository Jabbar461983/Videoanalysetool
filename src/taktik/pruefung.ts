import { neueId } from '../model/schema';
import type { FeldMasse, TaktikMarker } from '../model/typen';
import { rgbZuLab, type Rgb } from './farben';
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
  grund?: 'ausserhalb' | 'doppelt' | 'zuViele' | 'schiedsrichter';
  /** Mittlere Trikotfarbe (Oberkörper), falls gemessen */
  farbe?: Rgb;
  /** Als Schiedsrichter gewertet (automatisch erkannt oder vom Nutzer markiert) */
  schiedsrichter?: boolean;
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

/**
 * Klick auf eine Person: Team 1 → Team 2 → Schiedsrichter → nicht übernehmen → Team 1.
 * «Schiedsrichter» wird nicht übernommen und die Trikotfarbe fürs nächste Mal gemerkt.
 */
export function naechsterZustand(p: Person): Person {
  if (p.an && p.team === 0) return { ...p, team: 1 };
  if (p.an) return { ...p, an: false, schiedsrichter: true, grund: 'schiedsrichter' };
  if (p.schiedsrichter) return { ...p, schiedsrichter: false, grund: undefined };
  return { ...p, an: true, team: 0, grund: undefined, schiedsrichter: false };
}

/** Lab-Abstand zweier Farben. */
export function farbAbstand(a: Rgb, b: Rgb): number {
  const x = rgbZuLab(a);
  const y = rgbZuLab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Ab diesem Lab-Abstand zur gelernten Farbe gilt eine Person als Schiedsrichter. */
export const SCHIEDSRICHTER_NAEHE = 14;
/** Gelernte Farben werden nur angewandt, wenn sie mindestens so weit von beiden Teams entfernt sind. */
export const SCHIEDSRICHTER_ABSTAND_TEAMS = 20;

/**
 * Wendet die gelernten Schiedsrichterfarben an: Personen mit sehr ähnlicher Trikotfarbe werden abgewählt.
 * Ist eine gelernte Farbe der Farbe eines Teams zu ähnlich (z. B. beide schwarz), wird sie NICHT angewandt,
 * damit keine Spieler verloren gehen. `teamFarben` = mittlere Trikotfarben der beiden Teams (falls bekannt).
 */
export function wendeSchiedsrichterFarbenAn(
  personen: Person[],
  gelernt: Rgb[],
  teamFarben: [Rgb, Rgb] | null,
): { personen: Person[]; angewandt: number; uebersprungen: number } {
  const brauchbar = gelernt.filter(
    (g) =>
      !teamFarben || teamFarben.every((t) => farbAbstand(g, t) >= SCHIEDSRICHTER_ABSTAND_TEAMS),
  );
  const uebersprungen = gelernt.length - brauchbar.length;
  let angewandt = 0;
  const neu = personen.map((p) => {
    if (!p.an || !p.farbe) return p;
    if (brauchbar.some((g) => farbAbstand(p.farbe!, g) < SCHIEDSRICHTER_NAEHE)) {
      angewandt++;
      return { ...p, an: false, schiedsrichter: true, grund: 'schiedsrichter' as const };
    }
    return p;
  });
  return { personen: neu, angewandt, uebersprungen };
}

/** Trikotfarben der als Schiedsrichter markierten Personen, mit den bereits gelernten zusammengeführt (höchstens 6). */
export function lerneSchiedsrichterFarben(personen: Person[], bisher: Rgb[] = []): Rgb[] {
  const liste = [...bisher];
  for (const p of personen) {
    if (!p.schiedsrichter || !p.farbe) continue;
    if (liste.every((g) => farbAbstand(g, p.farbe!) >= 8)) liste.push(p.farbe);
  }
  return liste.slice(-6);
}

/** Alle Teams vertauschen (nur übernommene Personen sind betroffen). */
export const tauscheTeams = (liste: Person[]): Person[] =>
  liste.map((p) => (p.an ? { ...p, team: p.team === 0 ? 1 : 0 } : p));

/** Zählung für die Anzeige. */
export function zaehle(liste: Person[]): {
  team1: number;
  team2: number;
  aus: number;
  schiedsrichter: number;
} {
  return {
    schiedsrichter: liste.filter((p) => !p.an && p.schiedsrichter).length,
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
