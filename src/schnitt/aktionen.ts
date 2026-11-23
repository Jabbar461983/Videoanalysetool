import { useProjekt } from '../store/projektStore';
import { useSchnitt } from '../store/schnitt';
import { useUi } from '../store/ui';
import { useProgramm } from '../store/programm';
import { aktiveQuelle, aktuelleZeit } from '../tagging/aktionen';
import { neuerClip, trimmeClipImProjekt } from './schnittLogik';
import { formatZeit } from '../video/bildmathe';

export function setzeInPunkt(): void {
  const q = aktiveQuelle();
  if (q) useSchnitt.getState().setzeIn(aktuelleZeit(), q.id);
}
export function setzeOutPunkt(): void {
  const q = aktiveQuelle();
  if (q) useSchnitt.getState().setzeOut(aktuelleZeit(), q.id);
}

/** `true`, wenn In- und Out-Punkt gesetzt sind. */
export const hatPunkte = (): boolean => {
  const s = useSchnitt.getState();
  return s.inPunkt !== null && s.outPunkt !== null;
};

/** Enter: aus In/Out einen Clip speichern. Gibt true zurück, wenn ein Clip entstand. */
export function speichereClipAusPunkten(name?: string): boolean {
  const s = useSchnitt.getState();
  const p = useProjekt.getState().projekt;
  const q = p?.quellen.find((x) => x.id === s.quelleId);
  if (!q || s.inPunkt === null || s.outPunkt === null) return false;
  const clip = neuerClip(q, s.inPunkt, s.outPunkt, name);
  if (!clip) return false;
  useProjekt.getState().aendere('Clip speichern', (d) => {
    d.clips.push(clip);
  });
  s.loeschePunkte();
  s.waehleClip(clip.id);
  useUi.getState().setzeTab('clips');
  return true;
}

/** Shift+I / Shift+O: In bzw. Out des ausgewählten Clips auf das aktuelle Bild setzen. */
export function trimmeAuswahlAufPosition(seite: 'in' | 'out'): boolean {
  const id = useSchnitt.getState().gewaehlterClipId;
  const p = useProjekt.getState().projekt;
  const clip = p?.clips.find((c) => c.id === id);
  const q = p?.quellen.find((x) => x.id === clip?.quelleId);
  if (!clip || !q) return false;
  const zeit = aktuelleZeit();
  let ok = false;
  useProjekt.getState().aendere('Clip trimmen', (d) => {
    ok = trimmeClipImProjekt(d, clip.id, seite, zeit, q);
  });
  return ok;
}

/** In/Out des Clips um n Bilder verschieben (Knöpfe im Clip-Editor). */
export function nudgeClip(clipId: string, seite: 'in' | 'out', bilder: number): void {
  const p = useProjekt.getState().projekt;
  const clip = p?.clips.find((c) => c.id === clipId);
  const q = p?.quellen.find((x) => x.id === clip?.quelleId);
  if (!clip || !q) return;
  const ziel = (seite === 'in' ? clip.in : clip.out) + bilder / q.fps;
  useProjekt.getState().aendere('Clip trimmen', (d) => {
    trimmeClipImProjekt(d, clipId, seite, ziel, q);
  });
}

/**
 * «Zeichnen»-Knopf im Player: öffnet den Clip-Editor für den ausgewählten oder den an der aktuellen
 * Position liegenden Clip; gibt es keinen, entsteht ein Clip um die Position (4 s davor/danach).
 */
export function oeffneZeichnenFuerPosition(): void {
  const p = useProjekt.getState().projekt;
  const q = aktiveQuelle();
  if (!p || !q) return;
  const t = aktuelleZeit();
  const deckt = (c: { quelleId: string; in: number; out: number }) =>
    c.quelleId === q.id && t >= c.in - 1e-6 && t <= c.out + 1e-6;
  const gew = p.clips.find((c) => c.id === useSchnitt.getState().gewaehlterClipId);
  let clip = gew && deckt(gew) ? gew : p.clips.find(deckt);
  if (!clip) {
    const neu = neuerClip(q, t - 4, t + 4, `Zeichnung ${formatZeit(t, q.fps)}`);
    if (!neu) return;
    useProjekt.getState().aendere('Clip für Zeichnung', (d) => {
      d.clips.push(neu);
    });
    clip = neu;
  }
  useSchnitt.getState().waehleClip(clip.id);
  useUi.getState().setzeTab('clips');
  useProgramm.getState().oeffneClip(clip.id);
}
