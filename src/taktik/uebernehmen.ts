import type { FeldMasse, Kalibrierung, TaktikMarker } from '../model/typen';
import { neueId } from '../model/schema';
import { hexZuRgb, rgbZuLab, type Rgb } from './farben';
import { wendeAn, type Matrix3, type Pt } from './homographie';

export interface BildBox {
  cx: number;
  cy: number;
  b: number;
  h: number;
  score: number;
}

/** Fusspunkt (Mitte unten) einer Box in Bildkoordinaten 0–1. */
export const fussPunkt = (b: BildBox, breite: number, hoehe: number): Pt => ({
  x: b.cx / breite,
  y: (b.cy + b.h / 2) / hoehe,
});

/** Liegt der Punkt (Meter) im Feld, mit `rand` Metern Toleranz? (Zuschauer und Ersatzbank fallen heraus) */
export const imFeldBereich = (p: Pt, f: FeldMasse, rand = 1.5): boolean =>
  p.x >= -rand && p.x <= f.laenge + rand && p.y >= -rand && p.y <= f.breite + rand;

const iou = (a: BildBox, c: BildBox) => {
  const iw = Math.min(a.cx + a.b / 2, c.cx + c.b / 2) - Math.max(a.cx - a.b / 2, c.cx - c.b / 2);
  const ih = Math.min(a.cy + a.h / 2, c.cy + c.h / 2) - Math.max(a.cy - a.h / 2, c.cy - c.h / 2);
  if (iw <= 0 || ih <= 0) return 0;
  const i = iw * ih;
  return i / (a.b * a.h + c.b * c.h - i);
};

/** Doppelte Erkennungen (z. B. an Kachelrändern) entfernen: höchster Score gewinnt. */
export function unterdrueckeDoppelte(liste: BildBox[], schwelle = 0.5): BildBox[] {
  const sortiert = [...liste].sort((a, b) => b.score - a.score);
  const behalten: BildBox[] = [];
  for (const d of sortiert) if (behalten.every((k) => iou(k, d) < schwelle)) behalten.push(d);
  return behalten;
}

/**
 * Wandelt Erkennungen im Bild in Feldmarker: nur Spieler, deren Fusspunkt im Feld liegt.
 * `teams` (0/1 je Erkennung) kommt aus der Trikotfarbe; ohne Angabe sind alle Team 1.
 */
export function markerAusErkennungen(
  boxen: BildBox[],
  teams: number[] | null,
  H: Matrix3,
  feld: FeldMasse,
  breite: number,
  hoehe: number,
): TaktikMarker[] {
  const out: TaktikMarker[] = [];
  boxen.forEach((b, i) => {
    const m = wendeAn(H, fussPunkt(b, breite, hoehe));
    if (!m || !imFeldBereich(m, feld)) return;
    out.push({
      id: neueId(),
      art: teams && teams[i] === 1 ? 'team2' : 'team1',
      x: Math.min(feld.laenge, Math.max(0, m.x)),
      y: Math.min(feld.breite, Math.max(0, m.y)),
    });
  });
  return out;
}

/** Welche Gruppe (0/1) gehört zu Team 1? Die, deren mittlere Farbe der Farbe von Team 1 näher liegt. */
export function gruppeFuerTeam1(mitten: [Rgb, Rgb], teamFarbe1: string, teamFarbe2: string): 0 | 1 {
  const l1 = rgbZuLab(hexZuRgb(teamFarbe1));
  const l2 = rgbZuLab(hexZuRgb(teamFarbe2));
  const d = (m: Rgb, l: [number, number, number]) => {
    const a = rgbZuLab(m);
    return Math.hypot(a[0] - l[0], a[1] - l[1], a[2] - l[2]);
  };
  const kosten0 = d(mitten[0], l1) + d(mitten[1], l2);
  const kosten1 = d(mitten[1], l1) + d(mitten[0], l2);
  return kosten0 <= kosten1 ? 0 : 1;
}

/** Klick ins Video (0–1) → Feldposition in Metern; `null` ausserhalb des darstellbaren Bereichs. */
export function klickZuFeld(k: Pick<Kalibrierung, 'H'>, bild: Pt): Pt | null {
  return wendeAn(k.H, bild);
}
