import type {
  FeldMasse,
  MarkerArt,
  Situation,
  TafelAnzeige,
  TaktikMarker,
  TaktikPfeil,
  Team,
} from '../model/typen';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface Rechteck {
  x: number;
  y: number;
  b: number;
  h: number;
}

/** Seitenverhältnis (Breite/Höhe) der Tafel inkl. Rand. */
export const tafelSeitenverhaeltnis = (f: FeldMasse): number =>
  (f.laenge + 2 * RAND_M) / (f.breite + 2 * RAND_M);
const RAND_M = 2; // Rand um das Spielfeld in Metern

/**
 * Rechteck der Tafel im Bild: Bild-im-Bild (Ecke, Breite = `groesse` der Bildbreite, Abstand 2.5 %),
 * geteilt (rechte Bildhälfte, 42 % der Breite, volle Höhe) oder Vollbild.
 */
export function tafelRechteck(a: TafelAnzeige, W: number, H: number, f: FeldMasse): Rechteck {
  if (a.modus === 'voll') return { x: 0, y: 0, b: W, h: H };
  if (a.modus === 'geteilt') {
    const b = Math.round(W * 0.42);
    return { x: W - b, y: 0, b, h: H };
  }
  const b = Math.round(W * Math.min(0.6, Math.max(0.15, a.groesse)));
  const h = Math.round(b / tafelSeitenverhaeltnis(f));
  const rand = Math.round(W * 0.025);
  return {
    x: a.ecke === 'ol' || a.ecke === 'ul' ? rand : W - b - rand,
    y: a.ecke === 'ol' || a.ecke === 'or' ? rand : H - h - rand,
    b,
    h,
  };
}

/** Abbildung Feldmeter ↔ Pixel im Rechteck (Spielfeld zentriert, Seitenverhältnis erhalten). */
export function tafelAbbildung(f: FeldMasse, r: Rechteck) {
  const s = Math.min(r.b / (f.laenge + 2 * RAND_M), r.h / (f.breite + 2 * RAND_M));
  const ox = r.x + (r.b - f.laenge * s) / 2;
  const oy = r.y + (r.h - f.breite * s) / 2;
  return {
    s,
    px: (x: number, y: number) => ({ x: ox + x * s, y: oy + y * s }),
    meter: (px: number, py: number) => ({ x: (px - ox) / s, y: (py - oy) / s }),
  };
}

function rundRahmen(ctx: Ctx, x: number, y: number, b: number, h: number, r: number) {
  const rr = Math.min(r, b / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + b, y, x + b, y + h, rr);
  ctx.arcTo(x + b, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + b, y, rr);
  ctx.closePath();
}

const GOLD = '#BA990E';
const LINIE = '#e8e8e8';
const ROT = '#d9534f';
const BLAU = '#3d7bea';

/**
 * Spielfeld im Eishockey-Stil (Vektor): Eisfläche, Banden mit runden Ecken, rote Mittellinie, zwei blaue Linien
 * (Drittelsgrenzen), rote Torlinien, Mittelkreis, vier Bullykreise mit Markierungen in den Endzonen,
 * vier Bullypunkte in der neutralen Zone, Torräume (Halbkreis) und Tore.
 */
export function zeichneFeld(ctx: Ctx, f: FeldMasse, r: Rechteck, hintergrund = true): void {
  const m = tafelAbbildung(f, r);
  ctx.save();
  if (hintergrund) {
    ctx.fillStyle = 'rgba(20,20,20,0.92)';
    ctx.fillRect(r.x, r.y, r.b, r.h);
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = Math.max(1, m.s * 0.06);
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.b - 1, r.h - 1);
  }
  const L = f.laenge;
  const B = f.breite;
  const o = m.px(0, 0);
  const lw = Math.max(1.2, m.s * 0.1);
  const linie = (x0: number, y0: number, x1: number, y1: number, farbe: string, breite = lw) => {
    const a = m.px(x0, y0);
    const z = m.px(x1, y1);
    ctx.strokeStyle = farbe;
    ctx.lineWidth = breite;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(z.x, z.y);
    ctx.stroke();
  };
  const kreis = (cx: number, cy: number, rad: number, farbe: string, fuell?: string) => {
    const p = m.px(cx, cy);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad * m.s, 0, Math.PI * 2);
    if (fuell) {
      ctx.fillStyle = fuell;
      ctx.fill();
    }
    ctx.strokeStyle = farbe;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  const punkt = (cx: number, cy: number, farbe: string, rad = 0.28) => {
    const p = m.px(cx, cy);
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, m.s * rad), 0, Math.PI * 2);
    ctx.fill();
  };

  // Eisfläche und Bande (Bande innen als Clip, damit Linien nicht über die runden Ecken ragen)
  ctx.fillStyle = '#1e2a33';
  rundRahmen(ctx, o.x, o.y, L * m.s, B * m.s, f.eckenradius * m.s);
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Blaue Linien (Drittelsgrenzen) und rote Mittellinie
  const bl = f.blaueLinieAbstand;
  linie(L / 2 - bl, 0, L / 2 - bl, B, BLAU, lw * 2.4);
  linie(L / 2 + bl, 0, L / 2 + bl, B, BLAU, lw * 2.4);
  linie(L / 2, 0, L / 2, B, ROT, lw * 2.4);
  // gestrichelte Mitte der roten Linie (wie die Markierung auf dem Eis)
  ctx.save();
  ctx.setLineDash([m.s * 0.8, m.s * 0.8]);
  linie(L / 2, 0, L / 2, B, '#ffffff', lw * 0.7);
  ctx.restore();

  // Torlinien (rot, dünn)
  const tl = f.torLinieAbstand;
  linie(tl, 0, tl, B, ROT, lw);
  linie(L - tl, 0, L - tl, B, ROT, lw);

  // Mittelkreis und Anstosspunkt
  kreis(L / 2, B / 2, f.mittelkreisRadius, BLAU);
  punkt(L / 2, B / 2, BLAU);

  // Bullykreise der Endzonen mit Markierungen (kurze Striche ober-/unterhalb des Kreises)
  const rk = f.bullyKreisRadius;
  for (const sx of [-1, 1] as const)
    for (const sy of [-1, 1] as const) {
      const cx = L / 2 + sx * f.bullyX;
      const cy = B / 2 + sy * f.bullyY;
      kreis(cx, cy, rk, ROT);
      punkt(cx, cy, ROT);
      for (const dx of [-0.9, 0.9])
        for (const dy of [-1, 1]) {
          linie(cx + dx, cy + dy * rk, cx + dx, cy + dy * (rk + 0.7), ROT, lw * 0.9);
        }
      // kleine Winkel am Punkt («+»-Markierung)
      linie(cx - 0.9, cy, cx - 0.35, cy, ROT, lw * 0.7);
      linie(cx + 0.35, cy, cx + 0.9, cy, ROT, lw * 0.7);
    }

  // Bullypunkte der neutralen Zone (1.5 m innerhalb der blauen Linien)
  for (const sx of [-1, 1] as const)
    for (const sy of [-1, 1] as const)
      punkt(L / 2 + sx * (bl - 1.5), B / 2 + sy * f.bullyY, ROT, 0.24);
  ctx.restore();

  // Bande (Aussenlinie)
  rundRahmen(ctx, o.x, o.y, L * m.s, B * m.s, f.eckenradius * m.s);
  ctx.strokeStyle = LINIE;
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();

  // Torräume (Halbkreis vor dem Tor) und Tore (hinter der Torlinie)
  for (const seite of [0, 1] as const) {
    const lx = seite === 0 ? tl : L - tl;
    const innen = seite === 0 ? 1 : -1;
    const mitte = m.px(lx, B / 2);
    const rad = (f.torraumBreite / 2) * m.s;
    ctx.beginPath();
    ctx.arc(
      mitte.x,
      mitte.y,
      rad,
      innen > 0 ? -Math.PI / 2 : Math.PI / 2,
      innen > 0 ? Math.PI / 2 : (3 * Math.PI) / 2,
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(61,123,234,0.28)';
    ctx.fill();
    ctx.strokeStyle = ROT;
    ctx.lineWidth = lw;
    ctx.stroke();
    const g1 = m.px(lx, B / 2 - f.torBreite / 2);
    const gx = innen > 0 ? g1.x - f.torTiefe * m.s : g1.x;
    ctx.fillStyle = 'rgba(232,232,232,0.18)';
    ctx.fillRect(gx, g1.y, f.torTiefe * m.s, f.torBreite * m.s);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = lw;
    ctx.strokeRect(gx, g1.y, f.torTiefe * m.s, f.torBreite * m.s);
  }
  ctx.restore();
}

const PFEIL_STIL: Record<TaktikPfeil['art'], { farbe: string; dicke: number; strich: number[] }> = {
  laufweg: { farbe: '#ffffff', dicke: 0.16, strich: [0.6, 0.45] },
  pass: { farbe: GOLD, dicke: 0.2, strich: [] },
  schuss: { farbe: '#E53935', dicke: 0.3, strich: [] },
};

function zeichnePfeil(
  ctx: Ctx,
  p: TaktikPfeil,
  m: ReturnType<typeof tafelAbbildung>,
  alpha: number,
) {
  const st = PFEIL_STIL[p.art];
  const a = m.px(p.von.x, p.von.y);
  const b = m.px(p.nach.x, p.nach.y);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 2) return;
  const w = Math.max(1.5, st.dicke * m.s);
  const kopf = Math.max(6, 0.95 * m.s);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = st.farbe;
  ctx.fillStyle = st.farbe;
  ctx.lineWidth = w;
  ctx.setLineDash(st.strich.map((v) => v * m.s));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x - Math.cos(ang) * kopf * 0.6, b.y - Math.sin(ang) * kopf * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - kopf * Math.cos(ang - 0.42), b.y - kopf * Math.sin(ang - 0.42));
  ctx.lineTo(b.x - kopf * Math.cos(ang + 0.42), b.y - kopf * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const MARKER_RADIUS_M = 0.6;

export function markerFarbe(art: MarkerArt, teams: readonly Team[]): string {
  if (art === 'ball') return '#ffffff';
  return teams[art === 'team1' ? 0 : 1]?.farbe ?? (art === 'team1' ? '#007057' : '#BA990E');
}

function zeichneMarker(
  ctx: Ctx,
  mk: TaktikMarker,
  m: ReturnType<typeof tafelAbbildung>,
  teams: readonly Team[],
  alpha: number,
  hervorgehoben: boolean,
) {
  const p = m.px(mk.x, mk.y);
  const ball = mk.art === 'ball';
  const r = Math.max(ball ? 3 : 6, (ball ? 0.32 : MARKER_RADIUS_M) * m.s);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = markerFarbe(mk.art, teams);
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.18);
  ctx.strokeStyle = hervorgehoben ? GOLD : ball ? '#141414' : '#ffffff';
  ctx.stroke();
  if (!ball && mk.nummer !== undefined) {
    const fs = Math.max(8, r * 1.15);
    ctx.font = `bold ${fs}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const farbe = markerFarbe(mk.art, teams);
    ctx.fillStyle = helligkeit(farbe) > 0.6 ? '#000000' : '#ffffff';
    ctx.fillText(String(mk.nummer), p.x, p.y + fs * 0.04);
  }
  ctx.restore();
}

function helligkeit(hex: string): number {
  const mm = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!mm) return 0.5;
  const n = parseInt(mm[1]!, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

export interface TafelInhalt {
  marker: TaktikMarker[];
  pfeile: TaktikPfeil[];
  /** Deckkraft einzelner Marker (für das Überblenden bei der Animation), Standard 1 */
  markerAlpha?: Record<string, number>;
}

/** Komplette Tafel: Feld, Pfeile, Marker. `auswahlId` hebt einen Marker hervor (nur im Editor). */
export function zeichneTafel(
  ctx: Ctx,
  f: FeldMasse,
  teams: readonly Team[],
  inhalt: TafelInhalt,
  r: Rechteck,
  optionen: { auswahlId?: string | null; hintergrund?: boolean } = {},
): void {
  zeichneFeld(ctx, f, r, optionen.hintergrund ?? true);
  const m = tafelAbbildung(f, r);
  for (const p of inhalt.pfeile) zeichnePfeil(ctx, p, m, 1);
  for (const mk of inhalt.marker) {
    zeichneMarker(
      ctx,
      mk,
      m,
      teams,
      inhalt.markerAlpha?.[mk.id] ?? 1,
      mk.id === optionen.auswahlId,
    );
  }
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const glatt = (f: number) => f * f * (3 - 2 * f);

/**
 * Zwischenbild zwischen zwei Situationen (f = 0 → a, 1 → b): Marker mit gleicher Id gleiten; Marker nur in a
 * blenden aus, nur in b ein. Pfeile werden bei f < 0.5 aus a, sonst aus b gezeigt.
 */
export function mischeSituationen(a: Situation, b: Situation, f: number): TafelInhalt {
  const e = glatt(Math.min(1, Math.max(0, f)));
  const markerAlpha: Record<string, number> = {};
  const marker: TaktikMarker[] = [];
  const inB = new Map(b.marker.map((m) => [m.id, m]));
  for (const m of a.marker) {
    const z = inB.get(m.id);
    if (z) {
      marker.push({
        ...m,
        x: lerp(m.x, z.x, e),
        y: lerp(m.y, z.y, e),
        nummer: z.nummer ?? m.nummer,
      });
    } else {
      marker.push(m);
      markerAlpha[m.id] = 1 - e;
    }
  }
  const inA = new Set(a.marker.map((m) => m.id));
  for (const m of b.marker) {
    if (!inA.has(m.id)) {
      marker.push(m);
      markerAlpha[m.id] = e;
    }
  }
  return { marker, pfeile: e < 0.5 ? a.pfeile : b.pfeile, markerAlpha };
}
