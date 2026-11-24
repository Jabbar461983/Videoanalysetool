import type { Clip, Projekt } from '../model/typen';
import { animationsAnteil, abschnittBei, STANDARD_ANZEIGE } from '../taktik/logik';
import { mischeSituationen, tafelRechteck, zeichneTafel, type TafelInhalt } from '../taktik/tafel';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Inhalt der Tafel zur Clip-Zeit `t` (Situation oder Animation); `null`, wenn keine Tafel eingeblendet ist. */
export function tafelInhaltBei(projekt: Projekt, clip: Clip, t: number): TafelInhalt | null {
  const a = abschnittBei(clip, t);
  if (!a) return null;
  const sit = (id?: string) => projekt.taktik.situationen.find((s) => s.id === id);
  const von = sit(a.situationId);
  const nach = sit(a.nachSituationId);
  if (von && nach) return mischeSituationen(von, nach, animationsAnteil(a, t));
  const s = von ?? nach;
  return s ? { marker: s.marker, pfeile: s.pfeile } : { marker: [], pfeile: [] };
}

/** Zeichnet die Taktiktafel eines Clips (Bild-im-Bild, geteilt oder Vollbild), falls sie zur Zeit `t` eingeblendet ist. */
export function zeichneClipTafel(
  ctx: Ctx,
  projekt: Projekt,
  clip: Clip,
  t: number,
  breite: number,
  hoehe: number,
): void {
  const inhalt = tafelInhaltBei(projekt, clip, t);
  if (!inhalt) return;
  const anzeige = clip.taktik?.anzeige ?? STANDARD_ANZEIGE;
  const r = tafelRechteck(anzeige, breite, hoehe, projekt.taktik.feld);
  zeichneTafel(ctx, projekt.taktik.feld, projekt.teams, inhalt, r);
}
