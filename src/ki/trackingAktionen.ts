import type { Projekt, SpielerObjekt } from '../model/typen';
import { quellZeitFuer } from '../render/perspektive';
import { STANDARD_STANDBILD_DAUER } from '../schnitt/schnittLogik';
import { useDateien } from '../store/dateien';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useSpielerKi } from '../store/spielerKi';
import { clipPlan } from '../wiedergabe/zeitachse';
import { fuegeStandbildHinzu } from '../schnitt/schnittLogik';
import { leseKiGeraet } from './geraet';
import { fuegeSpurenZusammen, glaette, normalisiere, spurBei, verlorenAnteil } from './spur';
import { TrackingLauf } from './tracking';
import type { Box } from './tracker';

/** Erkennung langsamer als dies (Median je Bild) → Automatik nicht sinnvoll, Freeze-Frame verwenden. */
export const SCHNELLTEST_SCHWELLE_MS = 600;
/** Mehr als dieser Anteil «verloren» in der Spur → Freeze-Frame vorschlagen/verwenden. */
export const MAX_VERLOREN_ANTEIL = 0.3;
const SCHRITT = 1 / 12;
const TEST_SCHLUESSEL = 'bdva-tracking-schnelltest-v2';
const ERZWINGEN_SCHLUESSEL = 'bdva-tracking-erzwingen';

const setze = (p: Parameters<ReturnType<typeof useSpielerKi.getState>['setze']>[0]) =>
  useSpielerKi.getState().setze(p);
const projektOderNull = (): Projekt | null => useProjekt.getState().projekt;

let lauf: TrackingLauf | null = null;

export type AutomatikGrund = 'keinWebgpu' | 'zuLangsam';
export type AutomatikPruefung = { ok: true } | { ok: false; grund: AutomatikGrund; info: string };

export const automatikErzwungen = (): boolean => {
  try {
    return localStorage.getItem(ERZWINGEN_SCHLUESSEL) === '1';
  } catch {
    return false;
  }
};
export function erzwingeAutomatik(an: boolean): void {
  try {
    if (an) localStorage.setItem(ERZWINGEN_SCHLUESSEL, '1');
    else localStorage.removeItem(ERZWINGEN_SCHLUESSEL);
  } catch {
    /* egal */
  }
}

const infoText = (ms: number, geraet: string, gpuFehler: string): string =>
  geraet === 'webgpu'
    ? `Gemessen: ${Math.round(ms)} ms je Erkennung auf der Grafikkarte (Schwelle ${SCHNELLTEST_SCHWELLE_MS} ms).`
    : `WebGPU liess sich für die Erkennung nicht nutzen${gpuFehler ? ` (${gpuFehler.slice(0, 160)})` : ''}; auf dem Prozessor: ${Math.round(ms)} ms je Erkennung.`;

/** Misst die Erkennungszeit neu (verwirft das gemerkte Ergebnis). */
export async function wiederholeSchnelltest(): Promise<{ ok: boolean; info: string }> {
  try {
    localStorage.removeItem(TEST_SCHLUESSEL);
  } catch {
    /* egal */
  }
  if (!(await hatGpuAdapter())) return { ok: false, info: 'Dieser Browser bietet kein WebGPU.' };
  const r = await new TrackingLauf().schnelltest('webgpu');
  const ok = r.geraet === 'webgpu' && r.medianMs <= SCHNELLTEST_SCHWELLE_MS;
  if (r.geraet === 'webgpu') {
    try {
      localStorage.setItem(TEST_SCHLUESSEL, JSON.stringify({ ms: r.medianMs, geraet: r.geraet }));
    } catch {
      /* egal */
    }
  }
  return { ok, info: infoText(r.medianMs, r.geraet, r.gpuFehler) };
}

async function hatGpuAdapter(): Promise<boolean> {
  if (leseKiGeraet() === 'wasm') return false;
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

/**
 * Darf die Automatik verwendet werden? Nur mit WebGPU und wenn der einmalige Schnelltest (Erkennung pro Bild)
 * unter der Schwelle bleibt. Das Ergebnis wird je Gerät gemerkt. Für Tests erzwingt
 * `localStorage['bdva-tracking-erzwingen'] = '1'` die Automatik (auch ohne WebGPU).
 */
export async function pruefeAutomatik(): Promise<AutomatikPruefung> {
  if (automatikErzwungen()) return { ok: true };
  if (!(await hatGpuAdapter()))
    return { ok: false, grund: 'keinWebgpu', info: 'Dieser Browser bietet kein WebGPU.' };
  let ms: number | null = null;
  try {
    const s = JSON.parse(localStorage.getItem(TEST_SCHLUESSEL) ?? 'null') as { ms: number } | null;
    if (s && typeof s.ms === 'number') ms = s.ms;
  } catch {
    ms = null;
  }
  if (ms !== null)
    return ms <= SCHNELLTEST_SCHWELLE_MS
      ? { ok: true }
      : { ok: false, grund: 'zuLangsam', info: infoText(ms, 'webgpu', '') };
  setze({ tracking: { objId: '', anteil: 0, phase: 'pruefung', prozent: 0 } });
  try {
    const r = await new TrackingLauf({
      beiFortschritt: (p) =>
        setze({ tracking: { objId: '', anteil: 0, phase: 'modell', prozent: p } }),
    }).schnelltest('webgpu');
    // Nur eine echte Messung auf der Grafikkarte wird gemerkt; ein Rückfall auf die CPU nicht
    if (r.geraet === 'webgpu') {
      try {
        localStorage.setItem(TEST_SCHLUESSEL, JSON.stringify({ ms: r.medianMs, geraet: r.geraet }));
      } catch {
        /* egal */
      }
    }
    return r.geraet === 'webgpu' && r.medianMs <= SCHNELLTEST_SCHWELLE_MS
      ? { ok: true }
      : { ok: false, grund: 'zuLangsam', info: infoText(r.medianMs, r.geraet, r.gpuFehler) };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      grund: 'zuLangsam',
      info: `Der Geschwindigkeitstest ist fehlgeschlagen: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`,
    };
  } finally {
    setze({ tracking: null });
  }
}

function pixelDaten(p: Projekt, o: SpielerObjekt) {
  const clip = p.clips.find((c) => c.id === o.clipId);
  const q = p.quellen.find((x) => x.id === clip?.quelleId);
  const datei = clip ? useDateien.getState().dateien[clip.quelleId] : undefined;
  return clip && q && datei ? { clip, q, datei } : null;
}

/**
 * Verfolgt den Spieler über den Clip (vorwärts und rückwärts ab `startZeit`).
 * `ansatz` setzt die Verfolgung an einer neuen Stelle an (Korrektur): nur dieser Abschnitt wird ersetzt.
 * Bei Fehler, Abbruch oder zu schlechter Spur wird auf Freeze-Frame zurückgeschaltet (mit Meldung).
 */
export async function starteTracking(
  objId: string,
  ansatz?: { zeit: number; box: Box },
): Promise<void> {
  const p = projektOderNull();
  const o = p?.spielerObjekte.find((x) => x.id === objId);
  const kf = o?.maskenKeyframes[0];
  if (!p || !o || !kf) return;
  const d = pixelDaten(p, o);
  if (!d) {
    wechsleModus(objId, 'freeze', 'trackingFehler');
    return;
  }
  const { clip, q, datei } = d;
  const startZeit = ansatz?.zeit ?? o.klickZeit ?? clip.in;
  const startBox: Box = ansatz?.box ?? {
    cx: (kf.box.x + kf.box.b / 2) * q.breite,
    cy: (kf.box.y + kf.box.h / 2) * q.hoehe,
    b: kf.box.b * q.breite,
    h: kf.box.h * q.hoehe,
  };
  const von = ansatz ? Math.max(clip.in, startZeit - 1) : clip.in;
  setze({ tracking: { objId, anteil: 0, phase: 'modell', prozent: 0 }, meldung: null });
  lauf = new TrackingLauf({
    beiFortschritt: (prozent) =>
      setze({ tracking: { objId, anteil: 0, phase: 'modell', prozent } }),
    beiBereit: () => setze({ tracking: { objId, anteil: 0, phase: 'lauf', prozent: 100 } }),
    beiLauf: (anteil) => setze({ tracking: { objId, anteil, phase: 'lauf', prozent: 100 } }),
  });
  try {
    const r = await lauf.verfolge({
      datei,
      startZeit,
      startBox,
      von,
      bis: clip.out,
      schritt: SCHRITT,
    });
    if (r.abgebrochen) {
      wechsleModus(objId, 'freeze', 'trackingAbgebrochen');
      return;
    }
    const neu = glaette(normalisiere(r.punkte, q.breite, q.hoehe));
    const jetzt = projektOderNull()?.spielerObjekte.find((x) => x.id === objId);
    const gesamt = ansatz && jetzt?.spur ? fuegeSpurenZusammen(jetzt.spur, neu) : neu;
    useProjekt.getState().aendere('Spieler verfolgen', (dd) => {
      const x = dd.spielerObjekte.find((y) => y.id === objId);
      if (x) x.spur = gesamt;
    });
    if (verlorenAnteil(gesamt) > MAX_VERLOREN_ANTEIL)
      wechsleModus(objId, 'freeze', 'trackingSchlecht');
  } catch (e) {
    console.error(e);
    wechsleModus(objId, 'freeze', 'trackingFehler');
  } finally {
    lauf = null;
    setze({ tracking: null });
  }
}

export function abbrechenTracking(): void {
  lauf?.abbrechen();
}

/** Klick auf den (bereits ausgewählten) verfolgten Spieler: Tracking ab hier neu ansetzen. */
export async function korrigiereTracking(
  objId: string,
  pos: { x: number; y: number },
): Promise<void> {
  const p = projektOderNull();
  const o = p?.spielerObjekte.find((x) => x.id === objId);
  if (!p || !o?.spur) return;
  const d = pixelDaten(p, o);
  if (!d) return;
  const t = quellZeitFuer(p, o.clipId, usePlayer.getState().zeit);
  const jetzt = spurBei(o.spur, t);
  if (!jetzt) return;
  await starteTracking(objId, {
    zeit: t,
    box: {
      cx: pos.x * d.q.breite,
      cy: pos.y * d.q.hoehe,
      b: jetzt.b * d.q.breite,
      h: jetzt.h * d.q.hoehe,
    },
  });
}

/**
 * Wechselt den Modus eines Spielers. Freeze-Frame: Standbild an der Klickstelle (wird bei Bedarf eingefügt),
 * Spur verworfen. Automatisch: Spieler gilt für den ganzen Clip, Tracking startet.
 */
export function wechsleModus(
  objId: string,
  modus: 'auto' | 'freeze',
  meldung?: string,
): { start: number; ende: number } | null {
  const p = projektOderNull();
  const o = p?.spielerObjekte.find((x) => x.id === objId);
  const clip = p?.clips.find((c) => c.id === o?.clipId);
  const q = p?.quellen.find((x) => x.id === clip?.quelleId);
  if (!p || !o || !clip || !q) return null;
  if (modus === 'freeze') {
    const klick = o.klickZeit ?? clip.in;
    let span: { start: number; ende: number } | null = null;
    useProjekt.getState().aendere('Tracking: Freeze-Frame', (d) => {
      const c = d.clips.find((x) => x.id === clip.id);
      if (!c) return;
      const plan = clipPlan(c);
      const vorhanden = plan.segmente.find(
        (s) => s.art === 'freeze' && Math.abs((s.zeit ?? 0) - klick) < 1 / q.fps,
      );
      if (!vorhanden) fuegeStandbildHinzu(c, klick, STANDARD_STANDBILD_DAUER, q.fps);
      const f = clipPlan(c).segmente.find(
        (s) => s.art === 'freeze' && Math.abs((s.zeit ?? 0) - klick) < 1 / q.fps,
      );
      const x = d.spielerObjekte.find((y) => y.id === objId);
      if (x && f) {
        span = { start: f.start, ende: f.start + f.dauer };
        x.start = f.start;
        x.ende = f.start + f.dauer;
        x.trackingModus = 'freeze';
        delete x.spur;
      }
    });
    if (meldung) setze({ meldung });
    if (span) usePlayer.getState().suche((span as { start: number }).start + 0.001);
    return span;
  }
  const dauer = clipPlan(clip).dauer;
  useProjekt.getState().aendere('Tracking: Automatisch', (d) => {
    const x = d.spielerObjekte.find((y) => y.id === objId);
    if (x) {
      x.trackingModus = 'auto';
      x.start = 0;
      x.ende = dauer;
      x.versatz = { x: 0, y: 0 };
      delete x.spur;
    }
  });
  void pruefeAutomatik().then((r) => {
    if (r.ok) void starteTracking(objId);
    else
      wechsleModus(
        objId,
        'freeze',
        r.grund === 'keinWebgpu' ? 'trackingKeinWebgpu' : 'trackingZuLangsam',
      );
  });
  return { start: 0, ende: dauer };
}
