import type { Kalibrierung, Projekt, Situation } from '../model/typen';
import { TrackingLauf } from '../ki/tracking';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { formatZeit } from '../video/bildmathe';
import { aktuelleQuellPosition } from '../wiedergabe/transport';
import { aktuellesBild } from './bild';
import { mittlereFarbe, trenneTeams, type Rgb } from './farben';
import { bewerteKalibrierung, pruefePlausibilitaet, wendeAn } from './homographie';
import { neueSituation, neuerMarker } from './logik';
import { fussPunkt, gruppeFuerTeam1, imFeldBereich } from './uebernehmen';
import {
  MAX_SPIELER,
  baueAuswahl,
  lerneSchiedsrichterFarben,
  markerAusPersonen,
  wendeSchiedsrichterFarbenAn,
  type Person,
} from './pruefung';

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
    const feldPos = r.boxen.map((bx) => wendeAn(kal.H, fussPunkt(bx, fw, fh)));
    const imFeldIdx = r.boxen
      .map((_, i) => i)
      .filter(
        (i) =>
          feldPos[i] &&
          imFeldBereich(feldPos[i]!, projekt.taktik.feld, projekt.taktik.feld.erkennungsRand),
      );
    // Trikotfarbe: Oberkörper (20–50 % der Boxhöhe, mittlere Hälfte der Breite), nur für Personen im Feld
    const ctx = bild.frame.getContext('2d', { willReadFrequently: true })!;
    const farben = new Map<number, Rgb>();
    for (const i of imFeldIdx) {
      const b = r.boxen[i]!;
      const bx = Math.max(0, Math.floor(b.cx - b.b * 0.25));
      const by = Math.max(0, Math.floor(b.cy - b.h / 2 + b.h * 0.2));
      const bw = Math.max(1, Math.min(fw - bx, Math.ceil(b.b * 0.5)));
      const bh = Math.max(1, Math.min(fh - by, Math.ceil(b.h * 0.3)));
      const f = mittlereFarbe(ctx.getImageData(bx, by, bw, bh).data, bw, bh, 0, 0, bw, bh);
      if (f) farben.set(i, f);
    }
    let teams: number[] | null = null;
    let teamFarben: [Rgb, Rgb] | null = null;
    let farbHinweis = '';
    const idxMitFarbe = [...farben.keys()];
    if (idxMitFarbe.length >= 2) {
      const t = trenneTeams(idxMitFarbe.map((i) => farben.get(i)!));
      if (t.mitten && t.abstand >= MIN_FARBABSTAND) {
        const gruppe1 = gruppeFuerTeam1(t.mitten, projekt.teams[0].farbe, projekt.teams[1].farbe);
        teamFarben = [t.mitten[gruppe1], t.mitten[gruppe1 === 0 ? 1 : 0]];
        teams = r.boxen.map(() => 0);
        idxMitFarbe.forEach((idx, k) => {
          teams![idx] = t.zuordnung[k] === gruppe1 ? 0 : 1;
        });
      } else {
        farbHinweis =
          ' Die Trikotfarben liessen sich nicht trennen: bitte die Teams im Dialog per Klick zuordnen.';
      }
    }
    const auswahl0 = baueAuswahl(r.boxen, feldPos, teams, projekt.taktik.feld);
    auswahl0.personen.forEach((p, i) => {
      p.farbe = farben.get(i);
    });
    // Gelernte Schiedsrichterfarben anwenden (nur wenn die Teamfarben bekannt und klar verschieden sind)
    const gelernt = projekt.taktik.schiedsrichterFarben ?? [];
    const sr = teamFarben
      ? wendeSchiedsrichterFarbenAn(auswahl0.personen, gelernt, teamFarben)
      : { personen: auswahl0.personen, angewandt: 0, uebersprungen: gelernt.length };
    const auswahl = { ...auswahl0, personen: sr.personen };
    // Kalibrierung prüfen
    const plaus = pruefePlausibilitaet(
      kal.H,
      projekt.taktik.feld.laenge,
      projekt.taktik.feld.breite,
    );
    const guete = bewerteKalibrierung(
      { H: kal.H, rms: kal.rms, maxFehler: null },
      Math.hypot(projekt.taktik.feld.laenge, projekt.taktik.feld.breite),
    );
    const quelle = projekt.quellen.find((q) => q.id === bild.quelleId);
    const teile = [
      `${r.boxen.length} Personen erkannt`,
      auswahl.ausserhalb ? `${auswahl.ausserhalb} ausserhalb des Feldes (Zuschauer, Bank)` : '',
      auswahl.doppelt ? `${auswahl.doppelt} doppelt erkannt` : '',
      sr.angewandt ? `${sr.angewandt} Schiedsrichter (gelernte Farbe) ausgeschlossen` : '',
      auswahl.gekappt
        ? `${auswahl.gekappt} unsichere abgewählt (mehr als ${MAX_SPIELER} Spieler sind nicht zu erwarten)`
        : '',
    ].filter(Boolean);
    setze({
      erkennung: {
        frame: bild.frame,
        quelleId: bild.quelleId,
        quellZeit: bild.quellZeit,
        fps: quelle?.fps ?? 25,
        H: kal.H,
        personen: auswahl.personen,
        hinweis: `${teile.join(', ')}.${farbHinweis}${sr.uebersprungen ? ' Eine gelernte Schiedsrichterfarbe ist der Farbe eines Teams zu ähnlich und wurde nicht angewandt.' : ''}`,
        warnung: plaus.ok ? (guete === 'schlecht' ? 'schlecht' : undefined) : plaus.grund,
        kalibrierung: kal.name,
      },
      meldung: null,
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

/** Prüfdialog bestätigt: aus den gewählten Personen entsteht die Situation, der Tafel-Editor öffnet sich. */
export function bestaetigeErkennung(personen: Person[]): void {
  const t = useTaktik.getState();
  const projekt = useProjekt.getState().projekt;
  const e = t.erkennung;
  if (!projekt || !e) return;
  const marker = markerAusPersonen(personen, projekt.taktik.feld);
  const gelernt = lerneSchiedsrichterFarben(personen, projekt.taktik.schiedsrichterFarben ?? []);
  if (gelernt.length !== (projekt.taktik.schiedsrichterFarben ?? []).length)
    useProjekt.getState().aendereStill((pr) => {
      pr.taktik.schiedsrichterFarben = gelernt;
    });
  const szene = neueSzene(e.quellZeit, e.fps);
  szene.marker = marker;
  useProjekt
    .getState()
    .aendere('Situation übernehmen', (pr) => void pr.taktik.situationen.push(szene));
  setze({
    erkennung: null,
    situationId: szene.id,
    markerId: null,
    editorOffen: true,
    meldung: `${marker.length} Spieler übernommen. Bitte Nummern zuordnen.`,
  });
}
