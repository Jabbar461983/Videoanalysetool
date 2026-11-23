import { useProjekt } from '../store/projektStore';
import { clipDauer } from '../wiedergabe/zeitachse';
import { aendereSegmentZeit, findeSegment, neueSpur, sichereAudio } from './modell';
import { holeAudioRow } from './speicher';

/** Verschiebt oder kürzt ein Segment (Zahlenfelder und Ziehen in der Zeitleiste). */
export async function segmentAendern(
  clipId: string,
  segId: string,
  neuStart: number,
  neuEnde: number,
): Promise<void> {
  const clip = useProjekt.getState().projekt?.clips.find((c) => c.id === clipId);
  const f = clip && findeSegment(clip, segId);
  if (!clip || !f) return;
  const blobDauer = (await holeAudioRow(f.seg.blobId))?.dauer ?? f.seg.offset + f.seg.dauer;
  const gesamt = clipDauer(clip);
  useProjekt.getState().aendere('Kommentar bearbeiten', (p) => {
    const c = p.clips.find((x) => x.id === clipId);
    const g = c && findeSegment(c, segId);
    if (!g) return;
    Object.assign(g.seg, aendereSegmentZeit(g.seg, blobDauer, neuStart, neuEnde, gesamt));
  });
}

export function segmentLoeschen(clipId: string, segId: string): void {
  useProjekt.getState().aendere('Kommentar löschen', (p) => {
    const c = p.clips.find((x) => x.id === clipId);
    const g = c && findeSegment(c, segId);
    if (g) g.spur.segmente = g.spur.segmente.filter((s) => s.id !== segId);
  });
}

export function spurHinzufuegen(clipId: string): string | undefined {
  let id: string | undefined;
  useProjekt.getState().aendere('Tonspur', (p) => {
    const c = p.clips.find((x) => x.id === clipId);
    if (c) id = neueSpur(c).id;
  });
  return id;
}

export function spurLoeschen(clipId: string, spurId: string): void {
  useProjekt.getState().aendere('Tonspur löschen', (p) => {
    const c = p.clips.find((x) => x.id === clipId);
    if (c?.audio) c.audio.spuren = c.audio.spuren.filter((s) => s.id !== spurId);
  });
}

export function aendereTon(
  clipId: string,
  name: string,
  fn: (a: ReturnType<typeof sichereAudio>) => void,
): void {
  useProjekt.getState().aendere(name, (p) => {
    const c = p.clips.find((x) => x.id === clipId);
    if (c) fn(sichereAudio(c));
  });
}
