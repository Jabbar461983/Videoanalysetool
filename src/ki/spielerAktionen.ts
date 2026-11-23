import { neueId } from '../model/schema';
import type { MaskenKeyframe, Projekt, SpielerObjekt } from '../model/typen';
import { standardEffekte } from '../render/spieler';
import { fuegeStandbildHinzu, STANDARD_STANDBILD_DAUER } from '../schnitt/schnittLogik';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useSpielerKi } from '../store/spielerKi';
import { aktuelleClipId } from '../zeichnen/aktionen';
import { spieler } from '../wiedergabe/transport';
import { clipPlan, findeSegmentIndex } from '../wiedergabe/zeitachse';
import { ausschnittRahmen, bereinigeMaske, type Rahmen } from './ausschnitt';
import { STANDARD_SAM } from './modelle';
import { sam } from './sam';
import type { KlickPunkt } from './typen';
import {
  baueHintergrund,
  baueKeyframe,
  frameVonVideo,
  maskeAusBild,
  type GebauterKeyframe,
} from './spielerBau';

/** Laufende Arbeit am zuletzt markierten Spieler: Bild, Ausschnitt und Klickpunkte für Shift/Alt-Korrekturen. */
interface Sitzung {
  objId: string;
  frame: HTMLCanvasElement;
  crop: Rahmen;
  punkte: KlickPunkt[];
}
let sitzung: Sitzung | null = null;

const setze = (p: Parameters<ReturnType<typeof useSpielerKi.getState>['setze']>[0]) =>
  useSpielerKi.getState().setze(p);

export const hatWebGpu = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

function projektOderNull(): Projekt | null {
  return useProjekt.getState().projekt;
}

/** Lädt das Modell (einmalig) und meldet den Fortschritt in den Store. */
async function stelleModellSicher(): Promise<void> {
  const p = projektOderNull();
  const id = p?.einstellungen.samModell ?? STANDARD_SAM;
  if (sam.stand.status === 'bereit' && sam.stand.modell?.id === id) return;
  setze({ status: 'laedt', prozent: 0, meldung: null, detail: null });
  const ab = sam.beiStand((s) => setze({ prozent: s.prozent }));
  try {
    const st = await sam.lade(id);
    setze({ geraet: st.geraet });
  } catch (e) {
    setze({
      status: 'fehler',
      meldung: 'fehlerModell',
      detail: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    ab();
  }
}

/**
 * Sorgt dafür, dass die Position in einem Standbild liegt: steht der Abspielkopf schon in einem, wird dieses
 * benutzt; sonst wird eines (3 s) an der aktuellen Bildposition eingefügt. Gibt die Clip-Zeit-Spanne zurück.
 */
function sichereStandbild(clipId: string): { start: number; ende: number; neu: boolean } | null {
  const p = projektOderNull();
  const clip = p?.clips.find((c) => c.id === clipId);
  const q = p?.quellen.find((x) => x.id === clip?.quelleId);
  if (!p || !clip || !q) return null;
  const t = usePlayer.getState().zeit;
  const plan = clipPlan(clip);
  const seg = plan.segmente[findeSegmentIndex(plan.segmente, t)];
  if (seg?.art === 'freeze') return { start: seg.start, ende: seg.start + seg.dauer, neu: false };
  if (!seg || seg.art !== 'video' || seg.von === undefined) return null;
  const quellZeit = seg.von + (t - seg.start) * (seg.tempo ?? 1);
  useProjekt.getState().aendere('Standbild für Spieler', (d) => {
    const c = d.clips.find((x) => x.id === clipId);
    if (c) fuegeStandbildHinzu(c, quellZeit, STANDARD_STANDBILD_DAUER, q.fps);
  });
  const neuClip = useProjekt.getState().projekt?.clips.find((c) => c.id === clipId);
  if (!neuClip) return null;
  const neuePlan = clipPlan(neuClip);
  const f = neuePlan.segmente.find(
    (s2) => s2.art === 'freeze' && Math.abs((s2.zeit ?? 0) - quellZeit) < 1 / q.fps,
  );
  return f ? { start: f.start, ende: f.start + f.dauer, neu: true } : null;
}

function keyframeAus(zeit: number, g: GebauterKeyframe): MaskenKeyframe {
  return {
    zeit,
    box: g.box,
    bild: g.bild,
    ausschnitt: g.ausschnitt,
    lupeBox: g.lupeBox,
    fuss: g.fuss,
  };
}

export type KlickArt = 'neu' | 'plus' | 'minus';

/** Klick auf das Bild: neuer Spieler (`neu`) oder Korrektur des ausgewählten (`plus`/`minus`). Gibt Fehlertext-Schlüssel zurück. */
export async function klickAufSpieler(
  pos: { x: number; y: number },
  art: KlickArt,
): Promise<string | null> {
  const st = useSpielerKi.getState();
  if (st.status === 'laedt' || st.status === 'rechnet' || st.status === 'fuellt') return null;
  const clipId = aktuelleClipId();
  if (!clipId) return 'kein';
  try {
    // Korrektur am bestehenden Spieler
    if (art !== 'neu' && sitzung && sitzung.objId === st.auswahlId) {
      const s = sitzung;
      const px = pos.x * s.frame.width - s.crop.x;
      const py = pos.y * s.frame.height - s.crop.y;
      if (px < 0 || py < 0 || px >= s.crop.b || py >= s.crop.h) return 'ausserhalb';
      s.punkte.push({ x: px, y: py, label: art === 'plus' ? 1 : 0 });
      setze({ status: 'rechnet', meldung: null });
      const r = await sam.maske(s.punkte);
      const g = baueKeyframe(s.frame, r.maske, s.crop, r.breite, r.hoehe);
      if (!g) {
        s.punkte.pop();
        setze({ status: 'bereit' });
        return 'fehlerMaske';
      }
      useProjekt.getState().aendere('Spieler korrigieren', (d) => {
        const o = d.spielerObjekte.find((x) => x.id === s.objId);
        if (!o) return;
        const alt = o.maskenKeyframes[0];
        o.maskenKeyframes[0] = { ...keyframeAus(alt?.zeit ?? o.start, g) };
      });
      setze({ status: 'bereit' });
      return null;
    }

    // Neuer Spieler: erst das Bild sichern, dann ggf. Standbild einfügen
    spieler.pausiere();
    const video = spieler.aktivesElement;
    const frame = video ? frameVonVideo(video) : null;
    if (!frame) return 'kein';
    await stelleModellSicher();
    const span = sichereStandbild(clipId);
    if (!span) return 'kein';
    setze({ status: 'rechnet', meldung: null });
    const cx = pos.x * frame.width;
    const cy = pos.y * frame.height;
    const crop = ausschnittRahmen(frame.width, frame.height, cx, cy);
    const bm = await createImageBitmap(frame, crop.x, crop.y, crop.b, crop.h);
    await sam.einbetten(bm);
    const punkte: KlickPunkt[] = [{ x: cx - crop.x, y: cy - crop.y, label: 1 }];
    const r = await sam.maske(punkte);
    const sauber = bereinigeMaske(r.maske, r.breite, r.hoehe, punkte[0]!.x, punkte[0]!.y);
    const g = baueKeyframe(frame, sauber, crop, r.breite, r.hoehe);
    if (!g) {
      setze({ status: 'bereit' });
      return 'fehlerMaske';
    }
    const id = neueId();
    useProjekt.getState().aendere('Spieler freistellen', (d) => {
      const c = d.clips.find((x) => x.id === clipId);
      const o: SpielerObjekt = {
        id,
        clipId,
        quelleId: c?.quelleId ?? '',
        start: span.start,
        ende: span.ende,
        trackingModus: 'freeze',
        farbe: '#BA990E',
        effekte: standardEffekte(),
        versatz: { x: 0, y: 0 },
        pfeil: true,
        maskenKeyframes: [keyframeAus(span.start, g)],
      };
      d.spielerObjekte.push(o);
    });
    sitzung = { objId: id, frame, crop, punkte };
    // Abspielkopf sicher in das Standbild setzen (dessen Beginn liegt auf der Bildgrenze, ggf. nach der Klickposition)
    usePlayer.getState().suche(span.start + 0.001);
    setze({ status: 'bereit', auswahlId: id });
    return span.neu ? 'standbildEingefuegt' : null;
  } catch (e) {
    console.error(e);
    if (useSpielerKi.getState().status !== 'fehler')
      setze({ status: 'fehler', meldung: 'fehlerMaske' });
    return null;
  }
}

/** Füllt die Lücke an der alten Stelle (einmal je Spieler) – nötig, bevor er verschoben werden kann. */
export async function sichereHintergrund(objId: string): Promise<boolean> {
  const p = projektOderNull();
  const o = p?.spielerObjekte.find((x) => x.id === objId);
  const kf = o?.maskenKeyframes[0];
  if (!p || !o || !kf) return false;
  if (kf.hintergrund) return true;
  let frame: HTMLCanvasElement | null = null;
  if (sitzung && sitzung.objId === objId) frame = sitzung.frame;
  else {
    const t = usePlayer.getState().zeit;
    if (
      aktuelleClipId() === o.clipId &&
      t >= o.start - 1e-6 &&
      t < o.ende &&
      spieler.aktivesElement
    )
      frame = frameVonVideo(spieler.aktivesElement);
  }
  if (!frame) {
    setze({ meldung: 'zumStandbild' });
    return false;
  }
  setze({ status: 'fuellt', meldung: null });
  try {
    const bx = Math.round(kf.box.x * frame.width);
    const by = Math.round(kf.box.y * frame.height);
    const bb = Math.round(kf.box.b * frame.width);
    const bh = Math.round(kf.box.h * frame.height);
    const boxMaske = await maskeAusBild(kf.bild, bb, bh);
    const { daten } = await baueHintergrund(frame, { x: bx, y: by, b: bb, h: bh }, boxMaske);
    useProjekt.getState().aendereStill((d) => {
      const x = d.spielerObjekte.find((y) => y.id === objId)?.maskenKeyframes[0];
      if (x) x.hintergrund = daten;
    });
    setze({ status: 'bereit' });
    return true;
  } catch (e) {
    console.error(e);
    setze({ status: 'fehler', meldung: 'fehlerMaske' });
    return false;
  }
}

export function entferneSpieler(objId: string): void {
  useProjekt.getState().aendere('Spieler entfernen', (d) => {
    d.spielerObjekte = d.spielerObjekte.filter((x) => x.id !== objId);
  });
  if (sitzung?.objId === objId) sitzung = null;
  if (useSpielerKi.getState().auswahlId === objId) setze({ auswahlId: null, verschieben: false });
}

export function aendereSpieler(name: string, objId: string, fn: (o: SpielerObjekt) => void): void {
  useProjekt.getState().aendere(name, (d) => {
    const o = d.spielerObjekte.find((x) => x.id === objId);
    if (o) fn(o);
  });
}

/** Wählt einen Spieler aus; die Sitzung für Shift/Alt-Korrekturen gilt nur für den zuletzt erzeugten. */
export function waehleSpieler(objId: string | null): void {
  if (sitzung && sitzung.objId !== objId) sitzung = null;
  setze({ auswahlId: objId, meldung: null });
}
