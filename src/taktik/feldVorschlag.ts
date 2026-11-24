import type { FeldMasse } from '../model/typen';
import { rgbZuLab } from './farben';
import { referenzPunkte, type FeldPunkt } from './feld';
import { berechneKalibrierung, invertiere, wendeAn, type Matrix3, type Pt } from './homographie';

/**
 * Vorschlag für die Kalibrierung: Der Boden des Spielfelds wird im Standbild über seine Farbe gefunden, aus seinem
 * Umriss ergeben sich die vier Feldecken (verlängerte Banden), daraus eine Näherungs-Abbildung und die Lage aller
 * Referenzpunkte. Die Punkte sind nur Vorschläge (Banden verdecken den Rand, Ecken sind gerundet): Der Nutzer korrigiert.
 */
export interface BildDaten {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

const nachbarn4 = (w: number) => [-1, 1, -w, w];

function labFeld(img: BildDaten): Float32Array {
  const n = img.width * img.height;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [l, a, b] = rgbZuLab([img.data[i * 4]!, img.data[i * 4 + 1]!, img.data[i * 4 + 2]!]);
    lab[i * 3] = l;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }
  return lab;
}

const chroma = (lab: Float32Array, i: number) => Math.hypot(lab[i * 3 + 1]!, lab[i * 3 + 2]!);
const farbwinkel = (lab: Float32Array, i: number) => Math.atan2(lab[i * 3 + 2]!, lab[i * 3 + 1]!);
const winkelDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/** Mittel und Streuung der Farbe in einem Fenster um (x, y). */
function fensterStat(lab: Float32Array, w: number, h: number, x: number, y: number, r: number) {
  let n = 0;
  const m = [0, 0, 0];
  for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++)
    for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
      const i = yy * w + xx;
      for (let k = 0; k < 3; k++) m[k]! += lab[i * 3 + k]!;
      n++;
    }
  for (let k = 0; k < 3; k++) m[k]! /= n || 1;
  let v = 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++)
    for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
      const i = yy * w + xx;
      v +=
        (lab[i * 3]! - m[0]!) ** 2 +
        (lab[i * 3 + 1]! - m[1]!) ** 2 +
        (lab[i * 3 + 2]! - m[2]!) ** 2;
    }
  return { mittel: m as [number, number, number], streuung: Math.sqrt(v / (n || 1)) };
}

/** Automatischer Startpunkt: das farbigste, gleichmässige Fenster in der mittleren Bildhälfte (der Boden). */
export function findeSaat(img: BildDaten, lab = labFeld(img)): Pt | null {
  const { width: w, height: h } = img;
  const r = Math.max(3, Math.round(w / 100));
  let best: Pt | null = null;
  let bestWert = 0;
  for (let gy = 0.4; gy <= 0.85; gy += 0.05)
    for (let gx = 0.2; gx <= 0.8; gx += 0.05) {
      const x = Math.round(gx * w);
      const y = Math.round(gy * h);
      const s = fensterStat(lab, w, h, x, y, r);
      const c = Math.hypot(s.mittel[1], s.mittel[2]);
      const wert = c - s.streuung * 1.5;
      if (c > 12 && wert > bestWert) {
        bestWert = wert;
        best = { x, y };
      }
    }
  return best;
}

/** Boden als Maske (1 = Boden): Bereichswachstum nach Farbton und Sättigung, Lücken schliessen, grösster Block. */
export function findeBoden(
  img: BildDaten,
  saat?: Pt,
): { maske: Uint8Array; flaeche: number } | null {
  const { width: w, height: h } = img;
  const lab = labFeld(img);
  const start = saat ?? findeSaat(img, lab);
  if (!start) return null;
  const sx = Math.min(w - 1, Math.max(0, Math.round(start.x)));
  const sy = Math.min(h - 1, Math.max(0, Math.round(start.y)));
  const ref = fensterStat(lab, w, h, sx, sy, Math.max(2, Math.round(w / 150)));
  const refChroma = Math.hypot(ref.mittel[1], ref.mittel[2]);
  const refWinkel = Math.atan2(ref.mittel[2], ref.mittel[1]);
  if (refChroma < 8) return null; // Boden ohne erkennbare Farbe (grau): so nicht auffindbar
  // Alle farblich passenden Pixel (nicht nur zusammenhängende): Linien trennen den Boden sonst in Teile.
  const maske = new Uint8Array(w * h);
  for (let q = 0; q < w * h; q++) {
    if (chroma(lab, q) < refChroma * 0.45) continue;
    if (winkelDiff(farbwinkel(lab, q), refWinkel) > 0.55) continue; // ca. 31°
    if (Math.abs(lab[q * 3]! - ref.mittel[0]) > 50) continue;
    maske[q] = 1;
  }
  const geschlossen = schliesse(maske, w, h, Math.max(3, Math.round(w / 80)));
  const gross = groessterBlock(geschlossen, w, h);
  const gefuellt = fuelleLoecher(gross, w, h);
  let flaeche = 0;
  for (const v of gefuellt) flaeche += v;
  const anteil = flaeche / (w * h);
  if (anteil < 0.03 || anteil > 0.85) return null;
  return { maske: gefuellt, flaeche: anteil };
}

function box1d(
  src: Uint8Array,
  w: number,
  h: number,
  r: number,
  horizontal: boolean,
  dilate: boolean,
): Uint8Array {
  const out = new Uint8Array(src.length);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  for (let l = 0; l < lines; l++)
    for (let i = 0; i < len; i++) {
      let wert = dilate ? 0 : 1;
      for (let k = Math.max(0, i - r); k <= Math.min(len - 1, i + r); k++) {
        const v = src[horizontal ? l * w + k : k * w + l]!;
        if (dilate && v) {
          wert = 1;
          break;
        }
        if (!dilate && !v) {
          wert = 0;
          break;
        }
      }
      out[horizontal ? l * w + i : i * w + l] = wert;
    }
  return out;
}

/** Morphologisches Schliessen (Lücken kleiner als 2·r füllen: Linien, Spieler auf dem Boden). */
export function schliesse(maske: Uint8Array, w: number, h: number, r: number): Uint8Array {
  let m = box1d(box1d(maske, w, h, r, true, true), w, h, r, false, true);
  m = box1d(box1d(m, w, h, r, true, false), w, h, r, false, false);
  return m;
}

function groessterBlock(maske: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(maske.length);
  let bestId = 0;
  let bestN = 0;
  let id = 0;
  for (let s = 0; s < maske.length; s++) {
    if (!maske[s] || label[s]) continue;
    id++;
    let n = 0;
    const st = [s];
    label[s] = id;
    while (st.length) {
      const p = st.pop()!;
      n++;
      const x = p % w;
      for (const d of nachbarn4(w)) {
        const q = p + d;
        if (q < 0 || q >= w * h || !maske[q] || label[q]) continue;
        if ((d === -1 && x === 0) || (d === 1 && x === w - 1)) continue;
        label[q] = id;
        st.push(q);
      }
    }
    if (n > bestN) {
      bestN = n;
      bestId = id;
    }
  }
  const aus = new Uint8Array(maske.length);
  for (let i = 0; i < maske.length; i++) if (label[i] === bestId) aus[i] = 1;
  return aus;
}

function fuelleLoecher(maske: Uint8Array, w: number, h: number): Uint8Array {
  const aussen = new Uint8Array(maske.length);
  const st: number[] = [];
  const setze = (p: number) => {
    if (!maske[p] && !aussen[p]) {
      aussen[p] = 1;
      st.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    setze(x);
    setze((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    setze(y * w);
    setze(y * w + w - 1);
  }
  while (st.length) {
    const p = st.pop()!;
    const x = p % w;
    for (const d of nachbarn4(w)) {
      const q = p + d;
      if (q < 0 || q >= w * h) continue;
      if ((d === -1 && x === 0) || (d === 1 && x === w - 1)) continue;
      setze(q);
    }
  }
  const aus = new Uint8Array(maske.length);
  for (let i = 0; i < maske.length; i++) aus[i] = aussen[i] ? 0 : 1;
  return aus;
}

const kreuz = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Konvexe Hülle (Andrew), gegen den Uhrzeigersinn. */
export function huelle(punkte: Pt[]): Pt[] {
  const p = [...punkte].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const unten: Pt[] = [];
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2]!, unten[unten.length - 1]!, q) <= 0)
      unten.pop();
    unten.push(q);
  }
  const oben: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (oben.length >= 2 && kreuz(oben[oben.length - 2]!, oben[oben.length - 1]!, q) <= 0)
      oben.pop();
    oben.push(q);
  }
  return [...unten.slice(0, -1), ...oben.slice(0, -1)];
}

/** Randpunkte der Maske (Pixel mit mindestens einem Nachbarn ausserhalb). */
function randPunkte(maske: Uint8Array, w: number, h: number): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!maske[y * w + x]) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        !maske[y * w + x - 1] ||
        !maske[y * w + x + 1] ||
        !maske[(y - 1) * w + x] ||
        !maske[(y + 1) * w + x]
      )
        out.push({ x, y });
    }
  return out;
}

/** Hülle auf 4 Ecken vereinfachen: Der Eckpunkt mit dem kleinsten Flächenbeitrag fällt zuerst weg. */
export function aufVierEcken(h: Pt[]): Pt[] {
  const p = [...h];
  while (p.length > 4) {
    let besti = 0;
    let bestA = Infinity;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]!;
      const b = p[i]!;
      const c = p[(i + 1) % p.length]!;
      const A = Math.abs(kreuz(a, b, c));
      if (A < bestA) {
        bestA = A;
        besti = i;
      }
    }
    p.splice(besti, 1);
  }
  return p;
}

interface Gerade {
  px: number;
  py: number;
  dx: number;
  dy: number;
}

/** Ausgleichsgerade (Hauptachse) durch Punkte, mit zwei Durchgängen gegen Ausreisser. */
export function passeGerade(punkte: Pt[]): Gerade | null {
  let pts = punkte;
  let g: Gerade | null = null;
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    if (pts.length < 2) return g;
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const p of pts) {
      sxx += (p.x - mx) ** 2;
      sxy += (p.x - mx) * (p.y - my);
      syy += (p.y - my) ** 2;
    }
    const w = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    g = { px: mx, py: my, dx: Math.cos(w), dy: Math.sin(w) };
    const abst = (p: Pt) => Math.abs((p.x - g!.px) * g!.dy - (p.y - g!.py) * g!.dx);
    const mittel = pts.reduce((s, p) => s + abst(p), 0) / n;
    pts = pts.filter((p) => abst(p) <= Math.max(1.5, mittel * 2));
  }
  return g;
}

function schneide(a: Gerade, b: Gerade): Pt | null {
  const det = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / det;
  return { x: a.px + t * a.dx, y: a.py + t * a.dy };
}

/** Vier Ecken des Spielfelds (Pixel) aus der Bodenmaske: Gerade an jede Seite anpassen, benachbarte schneiden. */
export function schaetzeEcken(maske: Uint8Array, w: number, h: number): Pt[] | null {
  const rand = randPunkte(maske, w, h);
  if (rand.length < 20) return null;
  const hl = huelle(rand);
  const vier = aufVierEcken(hl);
  if (vier.length !== 4) return null;
  const diag = Math.hypot(w, h);
  const geraden: Gerade[] = [];
  for (let i = 0; i < 4; i++) {
    const a = vier[i]!;
    const b = vier[(i + 1) % 4]!;
    const laenge = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Randpunkte nahe der Seite, ohne die gerundeten Ecken (äusserste 15 % beidseits)
    const pts = rand.filter((p) => {
      const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (laenge * laenge);
      const d = Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / laenge;
      return t > 0.15 && t < 0.85 && d < diag * 0.04;
    });
    const g = passeGerade(pts);
    if (!g) return null;
    geraden.push(g);
  }
  const ecken: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const p = schneide(geraden[(i + 3) % 4]!, geraden[i]!);
    if (!p || p.x < -w || p.x > 2 * w || p.y < -h || p.y > 2 * h) return null;
    ecken.push(p);
  }
  return ecken;
}

/** Ecken als Oben-links, oben-rechts, unten-rechts, unten-links ordnen. */
export function ordneEcken(e: Pt[]): Pt[] {
  const nachY = [...e].sort((a, b) => a.y - b.y);
  const oben = nachY.slice(0, 2).sort((a, b) => a.x - b.x);
  const unten = nachY.slice(2).sort((a, b) => a.x - b.x);
  return [oben[0]!, oben[1]!, unten[1]!, unten[0]!];
}

export interface Ausrichtung {
  /** links ↔ rechts tauschen (Feld-x gespiegelt) */
  tauscheX: boolean;
  /** oben ↔ unten tauschen (Feld-y gespiegelt) */
  tauscheY: boolean;
  /** Kamera blickt von der Stirnseite: Feld um 90° drehen */
  quer: boolean;
}
export const STANDARD_AUSRICHTUNG: Ausrichtung = { tauscheX: false, tauscheY: false, quer: false };

/** Welche Feldecke gehört zur Bildecke i (oben-links, oben-rechts, unten-rechts, unten-links)? */
export function feldEcken(feld: Pick<FeldMasse, 'laenge' | 'breite'>, a: Ausrichtung): Pt[] {
  const { laenge: L, breite: B } = feld;
  const basis: Pt[] = [
    { x: 0, y: 0 },
    { x: L, y: 0 },
    { x: L, y: B },
    { x: 0, y: B },
  ];
  return basis.map((_, i) => {
    const p = basis[(i + (a.quer ? 1 : 0)) % 4]!;
    return { x: a.tauscheX ? L - p.x : p.x, y: a.tauscheY ? B - p.y : p.y };
  });
}

export interface Vorschlag {
  /** Ecken im Bild (0–1), geordnet oben-links … unten-links */
  ecken: Pt[];
  /** Bild (0–1) → Feld (m) */
  H: Matrix3;
  punkte: (FeldPunkt & { bild: Pt })[];
  /** Anteil des Bildes, den der gefundene Boden einnimmt */
  bodenAnteil: number;
}

/** Referenzpunkte, die auf der Spielfläche meist gut sichtbar sind und als Vorschlag angeboten werden. */
export const VORSCHLAG_IDS = [
  'bully-ol',
  'bully-or',
  'bully-ul',
  'bully-ur',
  'mitte',
  'neutral-ol',
  'neutral-or',
  'neutral-ul',
  'neutral-ur',
];

/** Rechnet aus den Bildecken die Abbildung und die Lage aller Referenzpunkte. */
export function vorschlagAusEcken(ecken: Pt[], feld: FeldMasse, a: Ausrichtung): Vorschlag | null {
  const fe = feldEcken(feld, a);
  const k = berechneKalibrierung(ecken.map((b, i) => ({ bild: b, feld: fe[i]! })));
  if (!k) return null;
  const inv = invertiere(k.H);
  if (!inv) return null;
  const punkte = referenzPunkte(feld)
    .map((p) => {
      const b = wendeAn(inv, { x: p.x, y: p.y });
      return b ? { ...p, bild: b } : null;
    })
    .filter((p): p is FeldPunkt & { bild: Pt } => !!p);
  return { ecken, H: k.H, punkte, bodenAnteil: 0 };
}

/** Komplett: Boden finden, Ecken schätzen, Punkte vorschlagen. `null`, wenn der Boden nicht gefunden wurde. */
export function schlageFeldVor(
  img: BildDaten,
  feld: FeldMasse,
  a: Ausrichtung = STANDARD_AUSRICHTUNG,
  saat?: Pt,
): Vorschlag | null {
  const boden = findeBoden(img, saat);
  if (!boden) return null;
  const ecken = schaetzeEcken(boden.maske, img.width, img.height);
  if (!ecken) return null;
  const norm = ordneEcken(ecken).map((p) => ({ x: p.x / img.width, y: p.y / img.height }));
  const v = vorschlagAusEcken(norm, feld, a);
  return v ? { ...v, bodenAnteil: boden.flaeche } : null;
}
