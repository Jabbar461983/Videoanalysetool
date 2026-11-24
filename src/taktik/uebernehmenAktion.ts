import type { Kalibrierung, Projekt, Situation } from '../model/typen';
import { TrackingLauf } from '../ki/tracking';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { formatZeit } from '../video/bildmathe';
import { aktuelleQuellPosition } from '../wiedergabe/transport';
import { aktuellesBild } from './bild';
import { mittlereFarbe, trenneTeams, type Rgb } from './farben';
import { wendeAn } from './homographie';
import { neueSituation, neuerMarker } from './logik';
import {
  fussPunkt,
  gruppeFuerTeam1,
  imFeldBereich,
  markerAusErkennungen,
  type BildBox,
} from './uebernehmen';

const setze = (p: Parameters<ReturnType<typeof useTaktik.getState>['setze']>[0]) =>
  useTaktik.getState().setze(p);

/** Die gültige Kalibrierung der Quelle (zuletzt gewählte, sonst die jüngste). */
export function kalibrierungFuer(p: Projekt, quelleId: string): Kalibrierung | undefined {
  const id = p.taktik.aktiveKalibrierung[quelleId];
  const liste = p.taktik.kalibrierungen.filter((k) => k.quelleId === quelleId);
  return liste.find((k) => k.id === id) ?? liste[liste.length - 1];
}

/** Gruppenabstand (Lab), ab dem die Trikotfarben als unterscheidbar gelten. */
const MIN_FARBABSTAND = 14;

function neueSzene(quellZeit: number, fps: number): Situation {
  return neueSituation(`Szene ${formatZeit(quellZeit, fps)}`);
}

/**
 * «Situation übernehmen» (automatisch): erkennt alle Spieler im aktuellen Standbild, projiziert die Fusspunkte
 * über die Kalibrierung aufs Feld und ordnet die Teams per Trikotfarbe zu. Das Ergebnis wird als neue Situation
 * im Tafel-Editor geöffnet (Fehler dort korrigieren, «Teams tauschen»).
 */
export async function uebernimmAlleSpieler(): Promise<void> {
  const projekt = useProjekt.getState().projekt;
  const bild = aktuellesBild();
  if (!projekt || !bild) {
    setze({ meldung: 'Es gibt kein Videobild: Spielen Sie ein Video ab und halten Sie es an.' });
    return;
  }
  const kal = kalibrierungFuer(projekt, bild.quelleId);
  if (!kal) {
    setze({
      meldung: 'Zuerst kalibrieren: «Neu kalibrieren …» (4 Punkte im Standbild anklicken).',
    });
    return;
  }
  setze({
    beschaeftigt: true,
    meldung: 'Spieler werden erkannt … (beim ersten Mal wird das Erkennungsmodell geladen)',
  });
  try {
    const bm = await createImageBitmap(bild.frame);
    const lauf = new TrackingLauf({
      beiFortschritt: (pz) => setze({ meldung: `Erkennungsmodell wird geladen … ${pz} %` }),
    });
    const r = await lauf.erkenneAlle(bm);
    const fw = bild.frame.width;
    const fh = bild.frame.height;
    const imFeld: BildBox[] = r.boxen.filter((b) => {
      const m = wendeAn(kal.H, fussPunkt(b, fw, fh));
      return m ? imFeldBereich(m, projekt.taktik.feld, projekt.taktik.feld.erkennungsRand) : false;
    });
    // Trikotfarbe: Oberkörper (20–50 % der Boxhöhe, mittlere Hälfte der Breite)
    const ctx = bild.frame.getContext('2d', { willReadFrequently: true })!;
    const farben: (Rgb | null)[] = imFeld.map((b) => {
      const x0 = b.cx - b.b * 0.25;
      const y0 = b.cy - b.h / 2 + b.h * 0.2;
      const bx = Math.max(0, Math.floor(x0));
      const by = Math.max(0, Math.floor(y0));
      const bw = Math.max(1, Math.min(fw - bx, Math.ceil(b.b * 0.5)));
      const bh = Math.max(1, Math.min(fh - by, Math.ceil(b.h * 0.3)));
      const d = ctx.getImageData(bx, by, bw, bh);
      return mittlereFarbe(d.data, bw, bh, 0, 0, bw, bh);
    });
    let teams: number[] | null = null;
    let hinweis = '';
    const gueltig = farben.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
    if (gueltig.length >= 2) {
      const t = trenneTeams(gueltig.map((i) => farben[i]!));
      if (t.mitten && t.abstand >= MIN_FARBABSTAND) {
        const gruppe1 = gruppeFuerTeam1(t.mitten, projekt.teams[0].farbe, projekt.teams[1].farbe);
        teams = imFeld.map(() => 0);
        gueltig.forEach((idx, k) => {
          teams![idx] = t.zuordnung[k] === gruppe1 ? 0 : 1;
        });
      } else {
        hinweis =
          ' Die Trikotfarben liessen sich nicht trennen: alle sind Team 1 (bitte im Editor zuordnen).';
      }
    }
    const marker = markerAusErkennungen(imFeld, teams, kal.H, projekt.taktik.feld, fw, fh);
    const quelle = projekt.quellen.find((q) => q.id === bild.quelleId);
    const szene = neueSzene(bild.quellZeit, quelle?.fps ?? 25);
    szene.marker = marker;
    useProjekt
      .getState()
      .aendere('Situation übernehmen', (pr) => void pr.taktik.situationen.push(szene));
    setze({
      situationId: szene.id,
      markerId: null,
      editorOffen: true,
      meldung: `${marker.length} Spieler übernommen (${r.boxen.length} erkannt, ${r.boxen.length - imFeld.length} ausserhalb des Feldes). Bitte Nummern und Teams prüfen.${hinweis}`,
    });
  } catch (e) {
    console.error(e);
    setze({
      meldung: `Die Erkennung ist fehlgeschlagen: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
    });
  } finally {
    setze({ beschaeftigt: false });
  }
}

/** Klick-Modus starten: legt (bei Bedarf) die Szene an; Klicks ins Video setzen Marker an der Fussposition. */
export function starteKlickModus(art: 'team1' | 'team2' | 'ball'): void {
  const projekt = useProjekt.getState().projekt;
  const bild = aktuellesBild();
  if (!projekt || !bild) {
    setze({ meldung: 'Es gibt kein Videobild: Spielen Sie ein Video ab und halten Sie es an.' });
    return;
  }
  if (!kalibrierungFuer(projekt, bild.quelleId)) {
    setze({
      meldung: 'Zuerst kalibrieren: «Neu kalibrieren …» (4 Punkte im Standbild anklicken).',
    });
    return;
  }
  let id = useTaktik.getState().uebernahmeId;
  if (!id || !projekt.taktik.situationen.some((s) => s.id === id)) {
    const quelle = projekt.quellen.find((q) => q.id === bild.quelleId);
    const szene = neueSzene(bild.quellZeit, quelle?.fps ?? 25);
    useProjekt
      .getState()
      .aendere('Situation übernehmen', (pr) => void pr.taktik.situationen.push(szene));
    id = szene.id;
  }
  setze({ klickModus: art, uebernahmeId: id, meldung: null });
}

export function beendeKlickModus(): void {
  const t = useTaktik.getState();
  setze({
    klickModus: null,
    situationId: t.uebernahmeId ?? t.situationId,
    editorOffen: !!t.uebernahmeId,
    uebernahmeId: null,
  });
}

/** Ein Klick im Video (normiert 0–1) im Klick-Modus: Marker an der projizierten Fussposition. */
export function klickInsVideo(pos: { x: number; y: number }): void {
  const t = useTaktik.getState();
  const projekt = useProjekt.getState().projekt;
  const bild = aktuelleQuellPosition()?.quelleId ?? null;
  if (!projekt || !t.klickModus || !t.uebernahmeId || !bild) return;
  const kal = kalibrierungFuer(projekt, bild);
  if (!kal) return;
  const m = wendeAn(kal.H, pos);
  if (!m || !imFeldBereich(m, projekt.taktik.feld, 3)) {
    setze({ meldung: 'Dieser Punkt liegt ausserhalb des Feldes.' });
    return;
  }
  const marker = neuerMarker(
    t.klickModus,
    Math.min(projekt.taktik.feld.laenge, Math.max(0, m.x)),
    Math.min(projekt.taktik.feld.breite, Math.max(0, m.y)),
  );
  useProjekt.getState().aendere('Marker per Klick', (pr) => {
    pr.taktik.situationen.find((s) => s.id === t.uebernahmeId)?.marker.push(marker);
  });
  setze({ meldung: null });
}
