/**
 * Eishockey-artiges Feld (rote Mittellinie, zwei blaue Linien, Torlinien, vier Bullykreise in den Endzonen,
 * Mittelkreis, vier Bullypunkte in der neutralen Zone, Torräume) in Metern. x läuft entlang der Länge (0 = linke Torlinienseite), y quer (0 = obere Bande).
 * ACHTUNG: Die Standardwerte sind **Platzhalter** (nicht anhand des Regelwerks geprüft) und sollen vom Verein an den
 * eigenen Platz angepasst werden (`geprueft` = false, bis jemand die Masse bestätigt).
 */
import type { FeldMasse } from '../model/typen';
export type { FeldMasse };

export const STANDARD_FELD: FeldMasse = {
  laenge: 40,
  breite: 20,
  eckenradius: 4,
  torLinieAbstand: 3,
  torBreite: 1.83,
  torTiefe: 1.0,
  torraumBreite: 3.6,
  torraumTiefe: 2.4,
  bullyX: 10,
  bullyY: 5,
  mittelkreisRadius: 3,
  blaueLinieAbstand: 40 / 6,
  bullyKreisRadius: 3,
  erkennungsRand: 0.3,
  geprueft: false,
};

export interface FeldPunkt {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Benannte Punkte des Feldes, die sich im Video gut finden lassen (für die Kalibrierung). */
export function referenzPunkte(f: FeldMasse): FeldPunkt[] {
  const { laenge: L, breite: B } = f;
  const a = f.torLinieAbstand;
  const ph = f.torBreite / 2;
  const bl = f.blaueLinieAbstand;
  const zx = 1.5; // Bullypunkte der neutralen Zone liegen 1.5 m innerhalb der blauen Linien
  // Reihenfolge: die ersten vier bilden ein Rechteck (gut konditioniert, nie drei auf einer Linie)
  return [
    {
      id: 'bully-ol',
      name: 'Bullykreis Endzone links oben',
      x: L / 2 - f.bullyX,
      y: B / 2 - f.bullyY,
    },
    {
      id: 'bully-or',
      name: 'Bullykreis Endzone rechts oben',
      x: L / 2 + f.bullyX,
      y: B / 2 - f.bullyY,
    },
    {
      id: 'bully-ul',
      name: 'Bullykreis Endzone links unten',
      x: L / 2 - f.bullyX,
      y: B / 2 + f.bullyY,
    },
    {
      id: 'bully-ur',
      name: 'Bullykreis Endzone rechts unten',
      x: L / 2 + f.bullyX,
      y: B / 2 + f.bullyY,
    },
    { id: 'mitte', name: 'Anstosspunkt (Mitte)', x: L / 2, y: B / 2 },
    { id: 'mittellinie-oben', name: 'Rote Linie an der oberen Bande', x: L / 2, y: 0 },
    { id: 'mittellinie-unten', name: 'Rote Linie an der unteren Bande', x: L / 2, y: B },
    { id: 'blau-l-oben', name: 'Blaue Linie links an der oberen Bande', x: L / 2 - bl, y: 0 },
    { id: 'blau-l-unten', name: 'Blaue Linie links an der unteren Bande', x: L / 2 - bl, y: B },
    { id: 'blau-r-oben', name: 'Blaue Linie rechts an der oberen Bande', x: L / 2 + bl, y: 0 },
    { id: 'blau-r-unten', name: 'Blaue Linie rechts an der unteren Bande', x: L / 2 + bl, y: B },
    {
      id: 'neutral-ol',
      name: 'Bullypunkt neutrale Zone links oben',
      x: L / 2 - bl + zx,
      y: B / 2 - f.bullyY,
    },
    {
      id: 'neutral-ul',
      name: 'Bullypunkt neutrale Zone links unten',
      x: L / 2 - bl + zx,
      y: B / 2 + f.bullyY,
    },
    {
      id: 'neutral-or',
      name: 'Bullypunkt neutrale Zone rechts oben',
      x: L / 2 + bl - zx,
      y: B / 2 - f.bullyY,
    },
    {
      id: 'neutral-ur',
      name: 'Bullypunkt neutrale Zone rechts unten',
      x: L / 2 + bl - zx,
      y: B / 2 + f.bullyY,
    },
    { id: 'tor-l-oben', name: 'Pfosten links oben', x: a, y: B / 2 - ph },
    { id: 'tor-l-unten', name: 'Pfosten links unten', x: a, y: B / 2 + ph },
    { id: 'tor-r-oben', name: 'Pfosten rechts oben', x: L - a, y: B / 2 - ph },
    { id: 'tor-r-unten', name: 'Pfosten rechts unten', x: L - a, y: B / 2 + ph },
    { id: 'torlinie-l-oben', name: 'Torlinie links an der oberen Bande', x: a, y: 0 },
    { id: 'torlinie-l-unten', name: 'Torlinie links an der unteren Bande', x: a, y: B },
    { id: 'torlinie-r-oben', name: 'Torlinie rechts an der oberen Bande', x: L - a, y: 0 },
    { id: 'torlinie-r-unten', name: 'Torlinie rechts an der unteren Bande', x: L - a, y: B },
  ];
}

/** Feldmasse sinnvoll begrenzen (Eingabefehler abfangen). */
export function bereinigeFeld(f: FeldMasse): FeldMasse {
  const k = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  const laenge = k(f.laenge, 10, 120);
  const breite = k(f.breite, 5, 80);
  return {
    ...f,
    laenge,
    breite,
    eckenradius: k(f.eckenradius, 0, Math.min(laenge, breite) / 2),
    torLinieAbstand: k(f.torLinieAbstand, 0, laenge / 4),
    torBreite: k(f.torBreite, 0.5, breite / 2),
    torTiefe: k(f.torTiefe, 0.2, 3),
    torraumBreite: k(f.torraumBreite, 0.5, breite / 2),
    torraumTiefe: k(f.torraumTiefe, 0.5, laenge / 4),
    bullyX: k(f.bullyX, 0, laenge / 2),
    bullyY: k(f.bullyY, 0, breite / 2),
    mittelkreisRadius: k(f.mittelkreisRadius, 0, Math.min(laenge, breite) / 2),
    blaueLinieAbstand: k(f.blaueLinieAbstand, 0.5, laenge / 2 - 0.5),
    bullyKreisRadius: k(f.bullyKreisRadius, 0.3, Math.min(laenge, breite) / 3),
    erkennungsRand: k(f.erkennungsRand, 0, 5),
  };
}
