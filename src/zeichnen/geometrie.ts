import type { Punkt, Werkzeug, ZeichenStil, Zeichnung } from '../model/typen';

/** Geometrie der Zeichnungen (rein, ohne Browser). Normierte Koordinaten 0–1; Pixelrechnungen mit Bildgrösse w × h. */

export interface P {
  x: number;
  y: number;
}

export const PALETTE = [
  { name: 'Gold', wert: '#BA990E' },
  { name: 'Grün', wert: '#007057' },
  { name: 'Weiss', wert: '#FFFFFF' },
  { name: 'Rot', wert: '#E53935' },
  { name: 'Blau', wert: '#2F80ED' },
  { name: 'Schwarz', wert: '#000000' },
] as const;

export const STANDARD_STIL: ZeichenStil = {
  farbe: '#BA990E',
  staerke: 6,
  deckkraft: 1,
  gestrichelt: false,
  spitze: 'ende',
};

/** Alle Grössen sind «Pixel bei 1920 Breite» und skalieren mit u = w / 1920. */
export const skala = (w: number): number => w / 1920;
export const textSchrift = (stil: ZeichenStil): number => 20 + stil.staerke * 3;
export const markerRadius = (stil: ZeichenStil): number => 16 + stil.staerke * 2;
export const spitzenLaenge = (stil: ZeichenStil): number => 14 + stil.staerke * 3;

export const zuPx = (p: Punkt, w: number, h: number): P => ({ x: p.x * w, y: p.y * h });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
export const begrenze01 = (v: number): number => Math.min(1, Math.max(0, v));

export function bezier(a: P, c: P, b: P, t: number): P {
  const m = 1 - t;
  return {
    x: m * m * a.x + 2 * m * t * c.x + t * t * b.x,
    y: m * m * a.y + 2 * m * t * c.y + t * t * b.y,
  };
}

/** Geglättete Polylinie durch Freihandpunkte (Mittelpunkt-Quadratik). */
export function glaetten(pts: P[], schritte = 5): P[] {
  if (pts.length < 3) return pts.slice();
  const out: P[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 =
      i === 1
        ? pts[0]!
        : { x: (pts[i - 1]!.x + pts[i]!.x) / 2, y: (pts[i - 1]!.y + pts[i]!.y) / 2 };
    const c = pts[i]!;
    const p1 =
      i === pts.length - 2
        ? pts[i + 1]!
        : { x: (pts[i]!.x + pts[i + 1]!.x) / 2, y: (pts[i]!.y + pts[i + 1]!.y) / 2 };
    for (let s = 1; s <= schritte; s++) out.push(bezier(p0, c, p1, s / schritte));
  }
  return out;
}

/** Abtastung des Pfades einer Zeichnung als Polylinie in Pixeln (für Strich, Treffer und «zeichnet sich»). */
export function pfad(z: Pick<Zeichnung, 'werkzeug' | 'punkte'>, w: number, h: number): P[] {
  const p = z.punkte.map((q) => zuPx(q, w, h));
  switch (z.werkzeug) {
    case 'pfeil':
    case 'linie': {
      const [a, b, c] = p;
      if (!a || !b) return [];
      if (!c) return [a, b];
      return Array.from({ length: 33 }, (_, i) => bezier(a, c, b, i / 32));
    }
    case 'freihand':
      return glaetten(p);
    case 'kreis': {
      const [m, eu, ev] = p;
      if (!m || !eu || !ev) return [];
      const u = { x: eu.x - m.x, y: eu.y - m.y };
      const v = { x: ev.x - m.x, y: ev.y - m.y };
      return Array.from({ length: 73 }, (_, i) => {
        const th = (i / 72) * Math.PI * 2;
        return {
          x: m.x + u.x * Math.cos(th) + v.x * Math.sin(th),
          y: m.y + u.y * Math.cos(th) + v.y * Math.sin(th),
        };
      });
    }
    case 'zone':
      return p.length > 2 ? [...p, p[0]!] : p;
    default:
      return p.slice(0, 1);
  }
}

export function laenge(pts: P[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1]!, pts[i]!);
  return l;
}

/** Der Anfang der Polylinie bis zum Anteil `a` (0–1) der Gesamtlänge. */
export function teilPfad(pts: P[], a: number): P[] {
  if (a >= 1 || pts.length < 2) return pts;
  const ziel = laenge(pts) * Math.max(0, a);
  const out: P[] = [pts[0]!];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = dist(pts[i - 1]!, pts[i]!);
    if (acc + s >= ziel) {
      const f = s === 0 ? 0 : (ziel - acc) / s;
      out.push({
        x: pts[i - 1]!.x + (pts[i]!.x - pts[i - 1]!.x) * f,
        y: pts[i - 1]!.y + (pts[i]!.y - pts[i - 1]!.y) * f,
      });
      return out;
    }
    acc += s;
    out.push(pts[i]!);
  }
  return out;
}

export function abstandPunktSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function abstandPfad(p: P, pts: P[]): number {
  if (pts.length === 1) return dist(p, pts[0]!);
  let m = Infinity;
  for (let i = 1; i < pts.length; i++)
    m = Math.min(m, abstandPunktSegment(p, pts[i - 1]!, pts[i]!));
  return m;
}

export function imPolygon(p: P, poly: P[]): boolean {
  let innen = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      innen = !innen;
  }
  return innen;
}

/** Ungefähre Textbox in Pixeln (Ankerpunkt oben links). */
export function textBox(z: Pick<Zeichnung, 'punkte' | 'stil' | 'text'>, w: number, h: number) {
  const u = skala(w);
  const s = textSchrift(z.stil) * u;
  const text = z.text ?? '';
  const pad = s * 0.35;
  const p = zuPx(z.punkte[0] ?? { x: 0, y: 0 }, w, h);
  return { x: p.x, y: p.y, b: Math.max(1, text.length) * s * 0.58 + pad * 2, h: s + pad * 2 };
}

/** Treffer an Pixelposition `p` (Toleranz `radius` in Pixeln). */
export function trifft(z: Zeichnung, p: P, w: number, h: number, radius: number): boolean {
  const u = skala(w);
  switch (z.werkzeug) {
    case 'text': {
      const b = textBox(z, w, h);
      return (
        p.x >= b.x - radius &&
        p.x <= b.x + b.b + radius &&
        p.y >= b.y - radius &&
        p.y <= b.y + b.h + radius
      );
    }
    case 'marker': {
      const m = zuPx(z.punkte[0] ?? { x: 0, y: 0 }, w, h);
      return dist(p, m) <= markerRadius(z.stil) * u + radius;
    }
    case 'zone': {
      const poly = pfad(z, w, h);
      return imPolygon(p, poly) || abstandPfad(p, poly) <= radius + (z.stil.staerke * u) / 2;
    }
    case 'kreis': {
      const poly = pfad(z, w, h);
      return imPolygon(p, poly) || abstandPfad(p, poly) <= radius + (z.stil.staerke * u) / 2;
    }
    default:
      return abstandPfad(p, pfad(z, w, h)) <= radius + (z.stil.staerke * u) / 2;
  }
}

/** Bearbeitbare Punkte (Griffe) einer Zeichnung: Index in `punkte`. */
export function griffIndizes(z: Pick<Zeichnung, 'werkzeug' | 'punkte'>): number[] {
  switch (z.werkzeug) {
    case 'pfeil':
    case 'linie':
    case 'zone':
    case 'kreis':
      return z.punkte.map((_, i) => i);
    default:
      return [];
  }
}

export function verschiebe(z: Zeichnung, dx: number, dy: number): Zeichnung {
  return { ...z, punkte: z.punkte.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
}

export function setzePunkt(z: Zeichnung, index: number, p: Punkt): Zeichnung {
  const punkte = z.punkte.map((q) => ({ ...q }));
  if (z.werkzeug === 'kreis' && index === 0) {
    // Mittelpunkt ziehen: Achsenpunkte wandern mit
    const m = z.punkte[0]!;
    return verschiebe(z, p.x - m.x, p.y - m.y);
  }
  if (punkte[index]) punkte[index] = { ...punkte[index]!, x: p.x, y: p.y };
  return { ...z, punkte };
}

/** Schaltet einen Pfeil/eine Linie zwischen gerade und gebogen um (Steuerpunkt in der Mitte, seitlich versetzt). */
export function schalteGebogen(z: Zeichnung, w: number, h: number): Zeichnung {
  if (z.werkzeug !== 'pfeil' && z.werkzeug !== 'linie') return z;
  const [a, b] = z.punkte;
  if (!a || !b) return z;
  if (z.punkte.length > 2) return { ...z, punkte: [a, b] };
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = (b.x - a.x) * w;
  const dy = (b.y - a.y) * h;
  const l = Math.hypot(dx, dy) || 1;
  const off = l * 0.25;
  return { ...z, punkte: [a, b, { x: mx + (-dy / l) * (off / w), y: my + (dx / l) * (off / h) }] };
}

/** Ramer-Douglas-Peucker in Pixeln. */
export function vereinfache(pts: P[], eps: number): number[] {
  if (pts.length < 3) return pts.map((_, i) => i);
  const behalten = new Set<number>([0, pts.length - 1]);
  const rek = (a: number, b: number) => {
    let dmax = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = abstandPunktSegment(pts[i]!, pts[a]!, pts[b]!);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (idx >= 0 && dmax > eps) {
      behalten.add(idx);
      rek(a, idx);
      rek(idx, b);
    }
  };
  rek(0, pts.length - 1);
  return [...behalten].sort((x, y) => x - y);
}

export const WERKZEUG_NAMEN: Record<Werkzeug, string> = {
  pfeil: 'Pfeil',
  linie: 'Linie',
  freihand: 'Freihand',
  kreis: 'Kreis',
  zone: 'Zone',
  text: 'Text',
  marker: 'Nummer',
};
