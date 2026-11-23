import { neueId } from '../model/schema';
import type {
  Clip,
  Projekt,
  Punkt,
  Werkzeug,
  ZeichenAnimation,
  ZeichenStil,
  Zeichnung,
} from '../model/typen';
import {
  clipSegmente,
  findeSegmentIndex,
  quellZeitZuClipZeit,
  segmenteDauer,
  type Segment,
} from '../wiedergabe/zeitachse';
import { skala, vereinfache, zuPx } from './geometrie';

export const STANDARD_DAUER = 3;
const runde = (x: number) => Math.round(x * 1000) / 1000;

/** Standard-Zeitspanne: ab `t` bis Ende des Standbilds, falls `t` in einem liegt, sonst `STANDARD_DAUER` (max. Clipende). */
export function standardZeitspanne(
  segmente: Segment[],
  t: number,
  standard = STANDARD_DAUER,
): { start: number; ende: number } {
  const dauer = segmenteDauer(segmente);
  const start = Math.min(Math.max(0, t), dauer);
  const seg = segmente[findeSegmentIndex(segmente, start)];
  let ende = start + standard;
  if (seg?.art === 'freeze') ende = seg.start + seg.dauer;
  ende = Math.min(ende, dauer);
  if (ende - start < 0.2) ende = Math.min(dauer, start + 0.2);
  return { start: runde(start), ende: runde(ende) };
}

export const kannWachsen = (w: Werkzeug): boolean =>
  w === 'pfeil' || w === 'linie' || w === 'freihand' || w === 'kreis';

/** Standard: Zeichnungen erscheinen sofort (so sieht man sie beim Zeichnen im Standbild); Animation wählt man bewusst. */
export const STANDARD_ANIMATION: ZeichenAnimation = {
  ein: 'keine',
  dauerEin: 0.8,
  aus: 'keine',
  dauerAus: 0.3,
};

/** «zeichnet sich» gibt es nur für Linienwerkzeuge; sonst wird eingeblendet. */
export function animationFuer(w: Werkzeug, a: ZeichenAnimation): ZeichenAnimation {
  if (a.ein === 'zeichnen' && !kannWachsen(w))
    return { ...a, ein: 'einblenden', dauerEin: Math.min(a.dauerEin, 0.5) };
  return { ...a };
}

export function neueZeichnung(
  werkzeug: Werkzeug,
  clipId: string,
  punkte: Punkt[],
  stil: ZeichenStil,
  zeit: { start: number; ende: number },
  extra: Partial<Pick<Zeichnung, 'text' | 'nummer'>> = {},
  animation: ZeichenAnimation = STANDARD_ANIMATION,
): Zeichnung {
  return {
    id: neueId(),
    clipId,
    start: zeit.start,
    ende: zeit.ende,
    werkzeug,
    punkte,
    stil: { ...stil, spitze: werkzeug === 'pfeil' ? stil.spitze : 'keine' },
    animation: animationFuer(werkzeug, animation),
    ...extra,
  };
}

/** Freihand: Rohpunkte (Pixel/normiert) vereinfachen; Druck bleibt erhalten. */
export function vereinfacheFreihand(punkte: Punkt[], w: number, h: number): Punkt[] {
  const px = punkte.map((p) => zuPx(p, w, h));
  const eps = 1.2 * skala(w) * 1.5 + 0.8;
  return vereinfache(px, eps).map((i) => punkte[i]!);
}

export const naechsteNummer = (p: Projekt, clipId: string): number =>
  Math.max(
    0,
    ...p.zeichnungen
      .filter((z) => z.clipId === clipId && z.werkzeug === 'marker')
      .map((z) => z.nummer ?? 0),
  ) + 1;

// ---------- Ebenenreihenfolge (Array-Reihenfolge = Zeichenreihenfolge, hinten → vorne) ----------

export function ebene(
  p: Projekt,
  id: string,
  wohin: 'vorn' | 'hinten' | 'hoeher' | 'tiefer',
): void {
  const i = p.zeichnungen.findIndex((z) => z.id === id);
  if (i < 0) return;
  const [z] = p.zeichnungen.splice(i, 1);
  if (!z) return;
  const ziel =
    wohin === 'vorn'
      ? p.zeichnungen.length
      : wohin === 'hinten'
        ? 0
        : wohin === 'hoeher'
          ? Math.min(p.zeichnungen.length, i + 1)
          : Math.max(0, i - 1);
  p.zeichnungen.splice(ziel, 0, z);
}

/** Kopie einer Zeichnung (neue Id, leicht versetzt, ab `start` mit gleicher Länge). */
export function kopiereZeichnung(
  z: Zeichnung,
  start: number,
  clipDauer: number,
  versatz = 0.02,
): Zeichnung {
  const laenge = Math.min(z.ende - z.start, Math.max(0.2, clipDauer - start));
  return {
    ...JSON.parse(JSON.stringify(z)),
    id: neueId(),
    start: runde(start),
    ende: runde(Math.min(clipDauer, start + laenge)),
    punkte: z.punkte.map((q) => ({ ...q, x: q.x + versatz, y: q.y + versatz })),
  };
}

export function entferneZeichnungenVonClip(p: Projekt, clipId: string): void {
  p.zeichnungen = p.zeichnungen.filter((z) => z.clipId !== clipId);
}

/** Duplizierte Clips bekommen Kopien ihrer Zeichnungen. */
export function dupliziereZeichnungen(p: Projekt, vonClipId: string, nachClipId: string): void {
  for (const z of p.zeichnungen.filter((x) => x.clipId === vonClipId)) {
    p.zeichnungen.push({ ...JSON.parse(JSON.stringify(z)), id: neueId(), clipId: nachClipId });
  }
}

// ---------- Zeitabgleich bei Änderungen der Clip-Zeitachse ----------

/**
 * Rechnet Start/Ende der Zeichnungen eines Clips von der alten auf die neue Zeitachse um,
 * sodass sie am selben Videobild (bzw. Standbild) bleiben. Zu kurz gewordene werden entfernt.
 */
export function zeitAbbildung(alt: Clip, neu: Clip): (t: number) => number {
  const altSegs = clipSegmente(alt);
  const neuSegs = clipSegmente(neu);
  const neuDauer = segmenteDauer(neuSegs);
  return (t: number): number => {
    const i = findeSegmentIndex(altSegs, t);
    const s = altSegs[i];
    let r = t;
    if (s) {
      if (s.art === 'freeze') {
        const k = altSegs
          .slice(0, i)
          .filter((x) => x.art === 'freeze' && Math.abs(x.zeit! - s.zeit!) < 1e-6).length;
        const kandidat = neuSegs.filter(
          (x) => x.art === 'freeze' && Math.abs(x.zeit! - s.zeit!) < 1e-6,
        )[k];
        r = kandidat
          ? kandidat.start + Math.min(Math.max(0, t - s.start), kandidat.dauer)
          : quellZeitZuClipZeit(neu, s.zeit!);
      } else {
        r = quellZeitZuClipZeit(neu, s.von! + Math.max(0, t - s.start) * s.tempo!);
      }
    }
    return Math.min(neuDauer, Math.max(0, r));
  };
}

/** Rechnet Zeitabschnitte von der alten auf die neue Clip-Zeitachse um; zu kurze entfallen. */
export function bildeAbschnitteAb(
  alt: Clip,
  neu: Clip,
  abschnitte: { start: number; ende: number }[],
): { start: number; ende: number }[] {
  const f = zeitAbbildung(alt, neu);
  const out: { start: number; ende: number }[] = [];
  for (const a of abschnitte) {
    const start = f(a.start);
    const ende = f(a.ende);
    if (ende - start >= 0.05) out.push({ start: runde(start), ende: runde(ende) });
  }
  return out;
}

/**
 * Rechnet Start/Ende der Zeichnungen eines Clips von der alten auf die neue Zeitachse um,
 * sodass sie am selben Videobild (bzw. Standbild) bleiben. Zu kurz gewordene werden entfernt.
 */
export function abgleichZeitachse(alt: Clip, neu: Clip, zeichnungen: Zeichnung[]): Zeichnung[] {
  const ergebnis: Zeichnung[] = [];
  for (const z of zeichnungen) {
    const [a] = bildeAbschnitteAb(alt, neu, [{ start: z.start, ende: z.ende }]);
    if (a) ergebnis.push({ ...z, start: a.start, ende: a.ende });
  }
  return ergebnis;
}

/** Führt `fn` an einem Clip aus und hält dabei die Zeichnungen am Videobild. Rückgabe: Ergebnis von `fn`. */
export function mitZeichnungsAbgleich<T>(
  p: Projekt,
  clipId: string,
  fn: (clip: Clip) => T,
): T | undefined {
  const clip = p.clips.find((c) => c.id === clipId);
  if (!clip) return undefined;
  const alt: Clip = JSON.parse(JSON.stringify(clip));
  const r = fn(clip);
  if (clip.ausblenden) {
    clip.ausblenden = {
      logo: bildeAbschnitteAb(alt, clip, clip.ausblenden.logo),
      scoreboard: bildeAbschnitteAb(alt, clip, clip.ausblenden.scoreboard),
    };
  }
  if (clip.audio?.spuren.length) {
    const f = zeitAbbildung(alt, clip);
    const gesamt = clipDauerVon(clip);
    for (const sp of clip.audio.spuren) {
      sp.segmente = sp.segmente.flatMap((seg) => {
        const start = Math.round(f(seg.start) * 1000) / 1000;
        const dauer = Math.min(seg.dauer, gesamt - start);
        return dauer >= 0.1 ? [{ ...seg, start, dauer: Math.round(dauer * 1000) / 1000 }] : [];
      });
    }
  }
  const meine = p.zeichnungen.filter((z) => z.clipId === clipId);
  if (meine.length) {
    const neu = new Map(abgleichZeitachse(alt, clip, meine).map((z) => [z.id, z]));
    p.zeichnungen = p.zeichnungen.flatMap((z) =>
      z.clipId !== clipId ? [z] : neu.has(z.id) ? [neu.get(z.id)!] : [],
    );
  }
  return r;
}

const clipDauerVon = (clip: Clip): number => segmenteDauer(clipSegmente(clip));
