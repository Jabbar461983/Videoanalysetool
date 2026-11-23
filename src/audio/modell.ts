import { neueId } from '../model/schema';
import type { AudioSegment, Clip, ClipAudio, KommentarSpur } from '../model/typen';

export const STANDARD_ABSENKUNG_DB = -12;
export const MIN_SEGMENT = 0.1;
const runde = (x: number) => Math.round(x * 1000) / 1000;

export const standardAudio = (): ClipAudio => ({
  original: { lautstaerke: 1, stumm: false, solo: false },
  ducking: { an: true, absenkungDb: STANDARD_ABSENKUNG_DB },
  spuren: [],
});

/** Audio-Einstellungen eines Clips (ohne den Clip zu verändern). */
export const holeAudio = (clip: Pick<Clip, 'audio'>): ClipAudio => clip.audio ?? standardAudio();

/** Stellt sicher, dass der Clip ein `audio`-Objekt hat (für Änderungen). */
export function sichereAudio(clip: Clip): ClipAudio {
  clip.audio ??= standardAudio();
  return clip.audio;
}

export function neueSpur(clip: Clip, name?: string): KommentarSpur {
  const a = sichereAudio(clip);
  const spur: KommentarSpur = {
    id: neueId(),
    name: name ?? `Spur ${a.spuren.length + 1}`,
    lautstaerke: 1,
    stumm: false,
    solo: false,
    segmente: [],
  };
  a.spuren.push(spur);
  return spur;
}

const ueberlappt = (s: AudioSegment, start: number, ende: number) =>
  start < s.start + s.dauer - 1e-6 && ende > s.start + 1e-6;

/** Wählt eine Spur, in der `[start, start+dauer]` frei ist; sonst entsteht eine neue. Die bevorzugte Spur hat Vorrang. */
export function spurFuer(
  clip: Clip,
  start: number,
  dauer: number,
  bevorzugt?: string,
): KommentarSpur {
  const a = sichereAudio(clip);
  const frei = (sp: KommentarSpur) => !sp.segmente.some((s) => ueberlappt(s, start, start + dauer));
  const kandidaten = [
    ...a.spuren.filter((s) => s.id === bevorzugt),
    ...a.spuren.filter((s) => s.id !== bevorzugt),
  ];
  return kandidaten.find(frei) ?? neueSpur(clip);
}

export function segment(blobId: string, start: number, dauer: number, offset = 0): AudioSegment {
  return { id: neueId(), blobId, start: runde(start), offset: runde(offset), dauer: runde(dauer) };
}

/**
 * Neue Zeitspanne eines Segments aus einer Ziehbewegung (`neuStart`/`neuEnde` in Clip-Zeit):
 * gleiche Länge → Verschieben, nur Anfang → Vorne kürzen/verlängern, nur Ende → Hinten kürzen/verlängern.
 * Nie über den Blob (`blobDauer`) oder das Clipende (`clipDauer`) hinaus.
 */
export function aendereSegmentZeit(
  seg: AudioSegment,
  blobDauer: number,
  neuStart: number,
  neuEnde: number,
  clipDauer: number,
): AudioSegment {
  const e0 = seg.start + seg.dauer;
  const neuLaenge = neuEnde - neuStart;
  let { start, offset, dauer } = seg;
  if (Math.abs(neuLaenge - seg.dauer) < 1e-3) {
    start = Math.min(Math.max(0, neuStart), Math.max(0, clipDauer - dauer));
  } else if (Math.abs(neuEnde - e0) < 1e-3) {
    const delta = Math.min(Math.max(neuStart - seg.start, -seg.offset), seg.dauer - MIN_SEGMENT);
    start = seg.start + delta;
    offset = seg.offset + delta;
    dauer = seg.dauer - delta;
  } else {
    dauer = Math.min(
      Math.max(neuEnde - seg.start, MIN_SEGMENT),
      blobDauer - seg.offset,
      clipDauer - seg.start,
    );
  }
  return {
    ...seg,
    start: runde(start),
    offset: runde(offset),
    dauer: runde(Math.max(MIN_SEGMENT, dauer)),
  };
}

export function findeSegment(
  clip: Clip,
  segId: string,
): { spur: KommentarSpur; seg: AudioSegment } | null {
  for (const spur of clip.audio?.spuren ?? []) {
    const seg = spur.segmente.find((s) => s.id === segId);
    if (seg) return { spur, seg };
  }
  return null;
}

/** Alle Blob-Ids, die ein Projekt noch verwendet (für das Aufräumen). */
export function benutzteBlobIds(clips: Clip[]): Set<string> {
  const ids = new Set<string>();
  for (const c of clips)
    for (const sp of c.audio?.spuren ?? []) for (const s of sp.segmente) ids.add(s.blobId);
  return ids;
}
