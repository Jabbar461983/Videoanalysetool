import type { Clip, Playlist, PlaylistEintrag } from '../model/typen';

/**
 * Zeitachsen-Logik für Clips und Playlists (rein, ohne Browser).
 * Vorschau (Programmspieler), Timeline-Anzeige und der Export (Etappe 6) benutzen dieselben Funktionen.
 */

export const BLENDE_DAUER = 0.3;
const EPS = 1e-6;

export type SegmentArt = 'video' | 'freeze' | 'titel';

export interface Segment {
  art: SegmentArt;
  /** Start auf der Zeitachse des Programms (Clip: ab 0; Playlist: ab Playlist-Anfang), Sekunden */
  start: number;
  dauer: number;
  quelleId?: string;
  /** video: Quellzeit-Bereich */
  von?: number;
  bis?: number;
  /** video: Wiedergabetempo (1 = normal) */
  tempo?: number;
  /** freeze: Quellzeit des Standbilds */
  zeit?: number;
  /** Index des Playlist-Eintrags (im Clip-Modus 0) */
  eintragIndex: number;
  clipId?: string;
  /** titel: der Eintrag */
  titel?: Extract<PlaylistEintrag, { typ: 'titel' }>;
}

/** Teilt einen Clip in Video- und Standbild-Segmente (clip-relative Zeit ab 0). */
export function clipSegmente(clip: Clip, eintragIndex = 0, offset = 0): Segment[] {
  const { in: a0, out: b0 } = clip;
  const freezes = clip.freezeFrames
    .filter((f) => f.zeit >= a0 - EPS && f.zeit <= b0 + EPS && f.dauer > 0)
    .map((f) => ({ zeit: Math.min(b0, Math.max(a0, f.zeit)), dauer: f.dauer }))
    .sort((x, y) => x.zeit - y.zeit);
  const zl = clip.zeitlupen
    .filter((z) => z.bis > z.von + EPS && z.tempo > 0)
    .sort((x, y) => x.von - y.von);

  const punkte = new Set<number>([a0, b0]);
  for (const f of freezes) punkte.add(f.zeit);
  for (const z of zl) {
    if (z.von > a0 + EPS && z.von < b0 - EPS) punkte.add(z.von);
    if (z.bis > a0 + EPS && z.bis < b0 - EPS) punkte.add(z.bis);
  }
  const p = [...punkte].sort((x, y) => x - y);

  const out: Segment[] = [];
  let t = offset;
  const freezeBei = (zeit: number) => {
    for (const f of freezes.filter((x) => Math.abs(x.zeit - zeit) < EPS)) {
      out.push({
        art: 'freeze',
        start: t,
        dauer: f.dauer,
        quelleId: clip.quelleId,
        zeit,
        eintragIndex,
        clipId: clip.id,
      });
      t += f.dauer;
    }
  };
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    freezeBei(a);
    if (b - a < EPS) continue;
    const z = zl.find((x) => x.von <= a + EPS && x.bis >= b - EPS);
    const tempo = z?.tempo ?? 1;
    const dauer = (b - a) / tempo;
    out.push({
      art: 'video',
      start: t,
      dauer,
      quelleId: clip.quelleId,
      von: a,
      bis: b,
      tempo,
      eintragIndex,
      clipId: clip.id,
    });
    t += dauer;
  }
  freezeBei(p[p.length - 1]!);
  return out;
}

export function segmenteDauer(segs: Segment[]): number {
  const l = segs[segs.length - 1];
  return l ? l.start + l.dauer : 0;
}
export const clipDauer = (clip: Clip): number => segmenteDauer(clipSegmente(clip));

export function findeSegmentIndex(segs: Segment[], t: number): number {
  if (segs.length === 0) return -1;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (t < s.start + s.dauer - EPS) return i;
  }
  return segs.length - 1;
}

export interface QuellPosition {
  quelleId: string;
  quellZeit: number;
  freeze: boolean;
  tempo: number;
  segmentIndex: number;
}

/** Abbildung Zeit im Programm → Zeit im Quellvideo (für Clip: Clip-Zeit; für Playlist: Playlist-Zeit). */
export function segmentZuQuellZeit(segs: Segment[], t: number): QuellPosition | null {
  const i = findeSegmentIndex(segs, t);
  const s = segs[i];
  if (!s || s.art === 'titel' || !s.quelleId) return null;
  if (s.art === 'freeze') {
    return { quelleId: s.quelleId, quellZeit: s.zeit!, freeze: true, tempo: 0, segmentIndex: i };
  }
  const lokal = Math.min(Math.max(0, t - s.start), s.dauer);
  return {
    quelleId: s.quelleId,
    quellZeit: s.von! + lokal * s.tempo!,
    freeze: false,
    tempo: s.tempo!,
    segmentIndex: i,
  };
}

/** Die zentrale Abbildung für Clips (auch vom Export genutzt). */
export function clipZeitZuQuellZeit(clip: Clip, tc: number): QuellPosition {
  const pos = segmentZuQuellZeit(clipSegmente(clip), tc);
  return (
    pos ?? { quelleId: clip.quelleId, quellZeit: clip.in, freeze: false, tempo: 1, segmentIndex: 0 }
  );
}

/** Umkehrung: erste Clip-Zeit, an der die Quellzeit gezeigt wird (nicht-Freeze). */
export function quellZeitZuClipZeit(clip: Clip, quellZeit: number): number {
  const segs = clipSegmente(clip);
  for (const s of segs) {
    if (s.art === 'video' && quellZeit >= s.von! - EPS && quellZeit <= s.bis! + EPS) {
      return s.start + (quellZeit - s.von!) / s.tempo!;
    }
  }
  return quellZeit < clip.in ? 0 : segmenteDauer(segs);
}

// ---------- Playlist ----------

export interface EintragZeit {
  index: number;
  eintrag: PlaylistEintrag;
  start: number;
  dauer: number;
}
export interface Zeitplan {
  segmente: Segment[];
  eintraege: EintragZeit[];
  dauer: number;
}

/** Baut die Zeitachse einer Playlist. Einträge mit fehlendem Clip werden übersprungen. */
export function playlistZeitplan(pl: Pick<Playlist, 'eintraege'>, clips: Clip[]): Zeitplan {
  const segmente: Segment[] = [];
  const eintraege: EintragZeit[] = [];
  let t = 0;
  pl.eintraege.forEach((e, index) => {
    if (e.typ === 'clip') {
      const clip = clips.find((c) => c.id === e.clipId);
      if (!clip) return;
      const segs = clipSegmente(clip, index, t);
      const d = segmenteDauer(segs) - t;
      segmente.push(...segs);
      eintraege.push({ index, eintrag: e, start: t, dauer: d });
      t += d;
    } else {
      const dauer = Math.max(0.5, e.dauer);
      segmente.push({ art: 'titel', start: t, dauer, eintragIndex: index, titel: e });
      eintraege.push({ index, eintrag: e, start: t, dauer });
      t += dauer;
    }
  });
  return { segmente, eintraege, dauer: t };
}

export function clipPlan(clip: Clip): Zeitplan {
  const segmente = clipSegmente(clip);
  const dauer = segmenteDauer(segmente);
  return {
    segmente,
    eintraege: [
      {
        index: 0,
        eintrag: { id: clip.id, typ: 'clip', clipId: clip.id, uebergang: 'schnitt' },
        start: 0,
        dauer,
      },
    ],
    dauer,
  };
}

/**
 * Deckkraft (0–1) des schwarzen Überblend-Rechtecks an Zeit t.
 * «Blende» am Eintrag i: letzte 0.15 s des Eintrags i−1 blenden ab, erste 0.15 s von i auf.
 */
export function blendeAlpha(plan: Zeitplan, t: number): number {
  const h = BLENDE_DAUER / 2;
  let alpha = 0;
  for (let k = 1; k < plan.eintraege.length; k++) {
    const e = plan.eintraege[k]!;
    if (e.eintrag.uebergang !== 'blende') continue;
    const grenze = e.start;
    if (t >= grenze - h && t < grenze) alpha = Math.max(alpha, (t - (grenze - h)) / h);
    else if (t >= grenze && t < grenze + h) alpha = Math.max(alpha, 1 - (t - grenze) / h);
  }
  return Math.min(1, Math.max(0, alpha));
}

export function eintragBei(plan: Zeitplan, t: number): EintragZeit | undefined {
  return (
    plan.eintraege.find((e) => t >= e.start - EPS && t < e.start + e.dauer - EPS) ??
    plan.eintraege[plan.eintraege.length - 1]
  );
}
