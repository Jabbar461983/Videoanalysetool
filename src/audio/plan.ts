import type { Projekt } from '../model/typen';
import type { Zeitplan } from '../wiedergabe/zeitachse';
import { holeAudio } from './modell';

/** Ein hörbares Kommentarstück in Programmzeit (Clip: ab 0; Playlist: ab Playlist-Anfang). */
export interface AudioEreignis {
  clipId: string;
  spurId: string;
  segId: string;
  blobId: string;
  start: number;
  dauer: number;
  /** Startposition im Blob */
  offset: number;
  gain: number;
}

/** Stützpunkt der Lautstärkekurve des Originaltons (linear interpoliert). */
export interface GainPunkt {
  t: number;
  gain: number;
}

export interface AudioPlan {
  ereignisse: AudioEreignis[];
  original: GainPunkt[];
}

export const DUCK_AB = 0.15;
export const DUCK_AUF = 0.25;
const EPS = 0.001;

const dbZuGain = (db: number) => Math.pow(10, db / 20);

function vereinige(iv: [number, number][]): [number, number][] {
  const s = [...iv].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const x of s) {
    const l = out[out.length - 1];
    if (l && x[0] <= l[1] + DUCK_AB + DUCK_AUF) l[1] = Math.max(l[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

/**
 * Hörplan eines Programms (Clip oder Playlist): Kommentar-Ereignisse und Gain-Kurve des Originaltons.
 * Standbilder: Das Video steht, der Originalton ist dort stumm (kommt aus dem Video); Kommentare laufen weiter.
 * Gemeinsame Grundlage für die Vorschau (Web Audio) und den Mixdown für den Export.
 */
export function audioPlan(plan: Zeitplan, projekt: Pick<Projekt, 'clips'>): AudioPlan {
  const ereignisse: AudioEreignis[] = [];
  const punkte: GainPunkt[] = [];
  const push = (t: number, gain: number) => {
    const l = punkte[punkte.length - 1];
    // streng wachsende Zeit: Sprünge werden zu sehr steilen Rampen
    punkte.push({ t: l && t <= l.t ? l.t + EPS : t, gain });
  };

  for (const e of plan.eintraege) {
    const eintrag = e.eintrag;
    if (eintrag.typ !== 'clip') {
      push(e.start, 0);
      push(e.start + e.dauer, 0);
      continue;
    }
    const clip = projekt.clips.find((c) => c.id === eintrag.clipId);
    if (!clip) continue;
    const a = holeAudio(clip);
    const solo = a.original.solo || a.spuren.some((s) => s.solo);
    const base = a.original.stumm || (solo && !a.original.solo) ? 0 : a.original.lautstaerke;
    const iv: [number, number][] = [];
    for (const sp of a.spuren) {
      if (sp.stumm || (solo && !sp.solo) || sp.lautstaerke <= 0) continue;
      for (const s of sp.segmente) {
        const dauer = Math.min(s.dauer, e.dauer - s.start);
        if (dauer < 0.02 || s.start >= e.dauer) continue;
        ereignisse.push({
          clipId: clip.id,
          spurId: sp.id,
          segId: s.id,
          blobId: s.blobId,
          start: e.start + s.start,
          dauer,
          offset: s.offset,
          gain: sp.lautstaerke,
        });
        iv.push([s.start, s.start + dauer]);
      }
    }
    push(e.start, base);
    if (a.ducking.an && iv.length > 0 && base > 0) {
      const tief = base * dbZuGain(a.ducking.absenkungDb);
      for (const [x, y] of vereinige(iv)) {
        const von = Math.max(0, x - DUCK_AB);
        const bis = Math.min(e.dauer, y + DUCK_AUF);
        if (von > 0) push(e.start + von, base);
        push(e.start + x, tief);
        push(e.start + y, tief);
        if (bis < e.dauer) push(e.start + bis, base);
      }
    }
    push(e.start + e.dauer, base);
  }
  ereignisse.sort((x, y) => x.start - y.start);
  return { ereignisse, original: punkte };
}

/** Wert der Kurve zur Programmzeit `t` (linear zwischen den Stützpunkten). */
export function gainBei(kurve: GainPunkt[], t: number): number {
  if (kurve.length === 0) return 1;
  if (t <= kurve[0]!.t) return kurve[0]!.gain;
  for (let i = 1; i < kurve.length; i++) {
    const a = kurve[i - 1]!;
    const b = kurve[i]!;
    if (t <= b.t) return a.gain + ((b.gain - a.gain) * (t - a.t)) / (b.t - a.t);
  }
  return kurve[kurve.length - 1]!.gain;
}
