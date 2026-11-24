/** Ebene Abbildung (Homographie) zwischen Videobild und Feld (Meter) aus Punktpaaren. Reines TypeScript. */

export interface Pt {
  x: number;
  y: number;
}
export interface PunktPaar {
  /** Bildposition, normiert 0–1 (x/Breite, y/Höhe) */
  bild: Pt;
  /** Feldposition in Metern */
  feld: Pt;
}
/** 3×3-Matrix, zeilenweise */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];

export function wendeAn(H: Matrix3, p: Pt): Pt | null {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  if (Math.abs(w) < 1e-12) return null;
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

export function invertiere(m: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-14) return null;
  const s = 1 / det;
  return [
    A * s,
    -(b * i - c * h) * s,
    (b * f - c * e) * s,
    B * s,
    (a * i - c * g) * s,
    -(a * f - c * d) * s,
    C * s,
    -(a * h - b * g) * s,
    (a * e - b * d) * s,
  ];
}

function mult(a: Matrix3, b: Matrix3): Matrix3 {
  const r = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j]! += a[i * 3 + k]! * b[k * 3 + j]!;
  return r as Matrix3;
}

/** Normalisierung (Schwerpunkt 0, mittlerer Abstand √2) für gut konditionierte Gleichungen. */
function normierung(pts: Pt[]): Matrix3 {
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p.x, 0) / n;
  const cy = pts.reduce((s, p) => s + p.y, 0) / n;
  const d = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / n;
  const s = d > 1e-12 ? Math.SQRT2 / d : 1;
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
}

/** Löst das lineare Gleichungssystem M·x = r (Gauss mit Spaltenpivot); `null` bei Singularität. */
function loese(M: number[][], r: number[]): number[] | null {
  const n = r.length;
  const a = M.map((z, i) => [...z, r[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i]![c]!) > Math.abs(a[p]![c]!)) p = i;
    if (Math.abs(a[p]![c]!) < 1e-10) return null;
    [a[c], a[p]] = [a[p]!, a[c]!];
    for (let i = c + 1; i < n; i++) {
      const f = a[i]![c]! / a[c]![c]!;
      for (let j = c; j <= n; j++) a[i]![j]! -= f * a[c]![j]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = a[i]![n]!;
    for (let j = i + 1; j < n; j++) s -= a[i]![j]! * x[j]!;
    x[i] = s / a[i]![i]!;
  }
  return x;
}

export interface Kalibrierergebnis {
  /** Bild (0–1) → Feld (m) */
  H: Matrix3;
  /** Mittlerer Fehler der Punkte in Metern; bei genau 4 Punkten nicht prüfbar (null) */
  rms: number | null;
  /** Grösster Fehler eines Punktes in Metern (null bei 4 Punkten) */
  maxFehler: number | null;
}

/**
 * Berechnet die Homographie Bild → Feld aus mindestens 4 Punktpaaren (Methode der kleinsten Quadrate mit
 * normierten Koordinaten). `null`, wenn die Punkte entartet sind (z. B. alle auf einer Linie oder nur drei Punkte
 * der vier auf einer Linie, sodass das Gleichungssystem nicht lösbar ist).
 */
export function berechneKalibrierung(paare: PunktPaar[]): Kalibrierergebnis | null {
  const n = paare.length;
  if (n < 4) return null;
  const Tb = normierung(paare.map((p) => p.bild));
  const Tf = normierung(paare.map((p) => p.feld));
  const nb = paare.map((p) => wendeAn(Tb, p.bild)!);
  const nf = paare.map((p) => wendeAn(Tf, p.feld)!);
  // Gleichungen mit h33 = 1: Σ (A·h − b)² minimal → (AᵀA)h = Aᵀb
  const AtA = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const Atb = new Array<number>(8).fill(0);
  const zeile = (r: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      Atb[i]! += r[i]! * rhs;
      for (let j = 0; j < 8; j++) AtA[i]![j]! += r[i]! * r[j]!;
    }
  };
  for (let i = 0; i < n; i++) {
    const { x, y } = nb[i]!;
    const { x: u, y: v } = nf[i]!;
    zeile([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    zeile([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = loese(AtA, Atb);
  if (!h) return null;
  const Hn: Matrix3 = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
  const Tfinv = invertiere(Tf);
  if (!Tfinv) return null;
  const H = mult(Tfinv, mult(Hn, Tb));
  const fehler = paare.map((p) => {
    const q = wendeAn(H, p.bild);
    return q ? Math.hypot(q.x - p.feld.x, q.y - p.feld.y) : Infinity;
  });
  if (fehler.some((f) => !Number.isFinite(f))) return null;
  const rms = Math.sqrt(fehler.reduce((s, f) => s + f * f, 0) / n);
  return {
    H,
    rms: n > 4 ? rms : null,
    maxFehler: n > 4 ? Math.max(...fehler) : null,
  };
}

/** Bewertung der Kalibrierung für die Anzeige. */
export type Guete = 'gut' | 'mittel' | 'schlecht' | 'ungeprueft';
export function bewerteKalibrierung(k: Kalibrierergebnis, feldDiagonale: number): Guete {
  if (k.rms === null) return 'ungeprueft';
  const rel = k.rms / feldDiagonale;
  return rel < 0.005 ? 'gut' : rel < 0.015 ? 'mittel' : 'schlecht';
}

/** Feld → Bild: Bildpunkt samt Nenner `w` (w ≤ 0 heisst: hinter der Kamera bzw. jenseits des Horizonts). */
function feldNachBild(inv: Matrix3, p: Pt): { x: number; y: number; w: number } {
  const w = inv[6] * p.x + inv[7] * p.y + inv[8];
  return {
    x: (inv[0] * p.x + inv[1] * p.y + inv[2]) / w,
    y: (inv[3] * p.x + inv[4] * p.y + inv[5]) / w,
    w,
  };
}

export type Plausibel =
  | { ok: true }
  | { ok: false; grund: 'nichtInvertierbar' | 'horizont' | 'verdreht' | 'nichtImBild' };

/**
 * Sieht die Kalibrierung vernünftig aus? Das Feld muss als gewöhnliches Viereck ins Bild fallen: alle Ecken vor der
 * Kamera, Viereck konvex und nicht verdreht (sonst wurden Punkte vertauscht), Feldmitte im Bild.
 * Typisches Zeichen einer falschen Kalibrierung: Feldlinien laufen quer durch den Himmel.
 */
export function pruefePlausibilitaet(Hbf: Matrix3, laenge: number, breite: number): Plausibel {
  const inv = invertiere(Hbf);
  if (!inv) return { ok: false, grund: 'nichtInvertierbar' };
  const ecken = [
    { x: 0, y: 0 },
    { x: laenge, y: 0 },
    { x: laenge, y: breite },
    { x: 0, y: breite },
  ].map((p) => feldNachBild(inv, p));
  const mitte = feldNachBild(inv, { x: laenge / 2, y: breite / 2 });
  if (![...ecken, mitte].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    return { ok: false, grund: 'horizont' };
  const vorzeichen = Math.sign(ecken[0]!.w);
  if (vorzeichen === 0 || [...ecken, mitte].some((p) => Math.sign(p.w) !== vorzeichen))
    return { ok: false, grund: 'horizont' };
  // Konvex und nicht verdreht: alle Kreuzprodukte aufeinanderfolgender Kanten haben dasselbe Vorzeichen
  const kreuz = ecken.map((a, i) => {
    const b = ecken[(i + 1) % 4]!;
    const c = ecken[(i + 2) % 4]!;
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (!(kreuz.every((k) => k > 0) || kreuz.every((k) => k < 0)))
    return { ok: false, grund: 'verdreht' };
  if (mitte.x < -0.1 || mitte.x > 1.1 || mitte.y < -0.1 || mitte.y > 1.1)
    return { ok: false, grund: 'nichtImBild' };
  return { ok: true };
}
