/** Multi-Object-Tracker nach dem ByteTrack-Prinzip (reines TypeScript, keine Abhängigkeiten). */

export interface Box {
  /** Mitte */
  cx: number;
  cy: number;
  /** Breite/Höhe */
  b: number;
  h: number;
}
export interface Erkennung {
  box: Box;
  score: number;
}
export interface Spur extends Box {
  id: number;
  vx: number;
  vy: number;
  score: number;
  /** Anzahl Schritte ohne Zuordnung in Folge */
  fehlt: number;
  /** Anzahl bisheriger Zuordnungen */
  treffer: number;
}

export function iou(a: Box, c: Box): number {
  const ax0 = a.cx - a.b / 2;
  const ay0 = a.cy - a.h / 2;
  const cx0 = c.cx - c.b / 2;
  const cy0 = c.cy - c.h / 2;
  const iw = Math.min(ax0 + a.b, cx0 + c.b) - Math.max(ax0, cx0);
  const ih = Math.min(ay0 + a.h, cy0 + c.h) - Math.max(ay0, cy0);
  if (iw <= 0 || ih <= 0) return 0;
  const i = iw * ih;
  return i / (a.b * a.h + c.b * c.h - i);
}

export interface TrackerEinstellung {
  /** Erkennungen ab diesem Score sind «sicher» (1. Stufe) */
  hoch: number;
  /** Erkennungen zwischen `tief` und `hoch` dienen nur der Wiederaufnahme (2. Stufe) */
  tief: number;
  /** Mindest-IoU Stufe 1 / Stufe 2 */
  iouHoch: number;
  iouTief: number;
  /** Neue Spur erst ab diesem Score */
  neu: number;
  /** Spur wird nach so vielen Schritten ohne Treffer gelöscht */
  maxFehlt: number;
  /** Glättung der Messung (0 = nur Vorhersage, 1 = nur Messung) */
  alpha: number;
  beta: number;
}
export const STANDARD_TRACKER: TrackerEinstellung = {
  hoch: 0.5,
  tief: 0.1,
  iouHoch: 0.25,
  iouTief: 0.3,
  neu: 0.5,
  maxFehlt: 12,
  alpha: 0.7,
  beta: 0.3,
};

/** Gierige Zuordnung nach absteigender Überlappung. */
function ordneZu(
  spuren: Spur[],
  dets: Erkennung[],
  minIou: number,
): { paare: [number, number][]; freieSpuren: number[]; freieDets: number[] } {
  const kandidaten: { s: number; d: number; v: number }[] = [];
  spuren.forEach((s, si) =>
    dets.forEach((d, di) => {
      const v = iou(s, d.box);
      if (v >= minIou) kandidaten.push({ s: si, d: di, v });
    }),
  );
  kandidaten.sort((a, b) => b.v - a.v);
  const sBelegt = new Set<number>();
  const dBelegt = new Set<number>();
  const paare: [number, number][] = [];
  for (const k of kandidaten) {
    if (sBelegt.has(k.s) || dBelegt.has(k.d)) continue;
    sBelegt.add(k.s);
    dBelegt.add(k.d);
    paare.push([k.s, k.d]);
  }
  return {
    paare,
    freieSpuren: spuren.map((_, i) => i).filter((i) => !sBelegt.has(i)),
    freieDets: dets.map((_, i) => i).filter((i) => !dBelegt.has(i)),
  };
}

export class ByteTracker {
  spuren: Spur[] = [];
  private naechsteId = 1;
  constructor(private readonly e: TrackerEinstellung = STANDARD_TRACKER) {}

  /** Neue Spur von Hand (z. B. der angeklickte Spieler). */
  starte(box: Box, score = 1): Spur {
    const s: Spur = { ...box, id: this.naechsteId++, vx: 0, vy: 0, score, fehlt: 0, treffer: 1 };
    this.spuren.push(s);
    return s;
  }

  /**
   * Ein Schritt: `dt` in Sekunden seit dem letzten Schritt, `dets` = Erkennungen dieses Bildes.
   * Gibt die aktiven Spuren zurück (auch solche, die gerade nur vorhergesagt werden).
   */
  schritt(dets: Erkennung[], dt: number): Spur[] {
    const e = this.e;
    // Vorhersage (konstante Geschwindigkeit)
    for (const s of this.spuren) {
      s.cx += s.vx * dt;
      s.cy += s.vy * dt;
    }
    const hoch = dets.filter((d) => d.score >= e.hoch);
    const tief = dets.filter((d) => d.score >= e.tief && d.score < e.hoch);
    const z1 = ordneZu(this.spuren, hoch, e.iouHoch);
    const aktualisiert = new Set<number>();
    for (const [si, di] of z1.paare) {
      this.aktualisiere(this.spuren[si]!, hoch[di]!, dt);
      aktualisiert.add(si);
    }
    // Stufe 2: übrige Spuren gegen schwache Erkennungen
    const rest = z1.freieSpuren.map((i) => this.spuren[i]!);
    const z2 = ordneZu(rest, tief, e.iouTief);
    for (const [ri, di] of z2.paare) {
      const si = this.spuren.indexOf(rest[ri]!);
      this.aktualisiere(rest[ri]!, tief[di]!, dt);
      aktualisiert.add(si);
    }
    this.spuren.forEach((s, i) => {
      if (!aktualisiert.has(i)) {
        s.fehlt++;
        s.score *= 0.9;
        s.vx *= 0.9;
        s.vy *= 0.9;
      }
    });
    // Neue Spuren aus sicheren, nicht zugeordneten Erkennungen
    for (const di of z1.freieDets) {
      const d = hoch[di]!;
      if (d.score >= e.neu) {
        this.spuren.push({
          ...d.box,
          id: this.naechsteId++,
          vx: 0,
          vy: 0,
          score: d.score,
          fehlt: 0,
          treffer: 1,
        });
      }
    }
    this.spuren = this.spuren.filter((s) => s.fehlt <= e.maxFehlt);
    return this.spuren;
  }

  private aktualisiere(s: Spur, d: Erkennung, dt: number) {
    const e = this.e;
    const rx = d.box.cx - s.cx;
    const ry = d.box.cy - s.cy;
    s.cx += e.alpha * rx;
    s.cy += e.alpha * ry;
    if (dt > 0) {
      s.vx += (e.beta * rx) / dt;
      s.vy += (e.beta * ry) / dt;
    }
    s.b += e.alpha * (d.box.b - s.b);
    s.h += e.alpha * (d.box.h - s.h);
    s.score = d.score;
    s.fehlt = 0;
    s.treffer++;
  }
}

export type ZielZustand = 'ok' | 'unsicher' | 'verloren';
export interface ZielSchritt {
  box: Box;
  /** 0–1: Vertrauen in die Position */
  konfidenz: number;
  zustand: ZielZustand;
}

/**
 * Verfolgt EINEN gewählten Spieler auf Basis des ByteTrackers. Geht die Spur verloren, wird sie an die
 * nächstgelegene neue Spur übergeben, wenn diese nahe der vorhergesagten Position liegt.
 */
export class ZielVerfolger {
  private tracker: ByteTracker;
  private zielId: number;
  private letzte: Box;
  constructor(start: Box, e: TrackerEinstellung = STANDARD_TRACKER) {
    this.tracker = new ByteTracker(e);
    this.zielId = this.tracker.starte(start).id;
    this.letzte = start;
  }

  schritt(dets: Erkennung[], dt: number): ZielSchritt {
    const spuren = this.tracker.schritt(dets, dt);
    let ziel = spuren.find((s) => s.id === this.zielId);
    if (!ziel || ziel.fehlt > 0) {
      // Übergabe an eine nahe, frische Spur (z. B. nach kurzer Verdeckung)
      const ref = ziel ?? { ...this.letzte, id: -1, vx: 0, vy: 0, score: 0, fehlt: 0, treffer: 0 };
      const kandidat = spuren
        .filter((s) => s.id !== this.zielId && s.fehlt === 0)
        .map((s) => ({ s, d: Math.hypot(s.cx - ref.cx, s.cy - ref.cy) / Math.max(ref.h, 1) }))
        .filter((k) => k.d < 0.8 && iou(k.s, ref) > 0.1)
        .sort((a, b) => a.d - b.d)[0];
      if (kandidat && (!ziel || ziel.fehlt >= 2)) {
        this.zielId = kandidat.s.id;
        ziel = kandidat.s;
      }
    }
    if (!ziel) {
      return { box: this.letzte, konfidenz: 0, zustand: 'verloren' };
    }
    this.letzte = { cx: ziel.cx, cy: ziel.cy, b: ziel.b, h: ziel.h };
    const konfidenz =
      ziel.fehlt === 0 ? Math.min(1, ziel.score) : Math.max(0, ziel.score * 0.8 ** ziel.fehlt);
    const zustand: ZielZustand =
      ziel.fehlt === 0 ? 'ok' : ziel.fehlt <= 3 ? 'unsicher' : 'verloren';
    return { box: this.letzte, konfidenz, zustand };
  }

  get position(): Box {
    return this.letzte;
  }
}
