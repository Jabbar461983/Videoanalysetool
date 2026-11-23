import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useAufnahme } from '../store/aufnahme';
import { clipDauer } from '../wiedergabe/zeitachse';
import { mixer, spieler } from '../wiedergabe/transport';
import { listeMikrofone, Mikrofon } from './aufnahme';
import { findeSegment, segment, spurFuer } from './modell';
import { speichereAufnahme, speichereRoh } from './speicher';

let mik: Mikrofon | null = null;
let pegelRaf = 0;
export const COUNTDOWN_SCHRITT_MS = 1000;

const meldung = (e: unknown): string => {
  const n = (e as DOMException | undefined)?.name;
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'Der Zugriff auf das Mikrofon wurde nicht erlaubt. Erlaube ihn in der Adressleiste und versuche es erneut.';
  if (n === 'NotFoundError') return 'Es wurde kein Mikrofon gefunden.';
  return 'Das Mikrofon konnte nicht geöffnet werden.';
};

function pegelSchleife() {
  const st = useAufnahme.getState();
  if (st.phase === 'aus' || !mik) return;
  st.setze({ pegel: mik.pegel() });
  pegelRaf = requestAnimationFrame(pegelSchleife);
}

/** Fragt die Berechtigung an, listet die Mikrofone und zeigt den Pegel. */
export async function oeffneMikrofon(geraetId?: string): Promise<void> {
  const st = useAufnahme.getState();
  try {
    mik?.schliesse();
    mik = await Mikrofon.oeffne(geraetId);
    const geraete = await listeMikrofone();
    st.setze({ phase: 'bereit', geraete, geraetId: mik.geraetId ?? geraetId, fehler: null });
    cancelAnimationFrame(pegelRaf);
    pegelSchleife();
  } catch (e) {
    st.setze({ phase: 'aus', fehler: meldung(e) });
  }
}

export function schliesseMikrofon(): void {
  cancelAnimationFrame(pegelRaf);
  mik?.schliesse();
  mik = null;
  useAufnahme.getState().setze({ phase: 'aus', pegel: 0, countdown: 0 });
}

let ziel: { clipId: string; start: number; ersetzeSegId?: string } | null = null;
let abbruch = false;
let unsub: (() => void) | null = null;

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Countdown 3-2-1 (Bild steht), dann Aufnahme ab Position `start` (Clip-Zeit) zusammen mit der Wiedergabe.
 * `ersetzeSegId`: «Neu aufnehmen» – ersetzt dieses Segment ab seinem Start.
 */
export async function starteAufnahme(
  opt: { start?: number; ersetzeSegId?: string } = {},
): Promise<void> {
  const st = useAufnahme.getState();
  const g = useProgramm.getState();
  if (!mik || st.phase !== 'bereit' || g.art !== 'clip' || !g.clipId) return;
  const projekt = useProjekt.getState().projekt;
  const clip = projekt?.clips.find((c) => c.id === g.clipId);
  if (!clip) return;
  const gesamt = clipDauer(clip);
  let start = opt.start ?? usePlayer.getState().zeit;
  if (opt.ersetzeSegId) {
    const f = findeSegment(clip, opt.ersetzeSegId);
    if (f) start = f.seg.start;
  }
  if (start >= gesamt - 0.2) start = 0;
  ziel = { clipId: g.clipId, start, ersetzeSegId: opt.ersetzeSegId };
  abbruch = false;
  spieler.pausiere();
  await spieler.springe(start);
  void mixer.resume();
  for (let n = 3; n >= 1; n--) {
    st.setze({ phase: 'countdown', countdown: n });
    await warte(COUNTDOWN_SCHRITT_MS);
    if (abbruch) return;
  }
  st.setze({ phase: 'laeuft', countdown: 0 });
  mik.beginne();
  await spieler.abspielen();
  // Pause oder Ende der Wiedergabe beendet die Aufnahme
  unsub?.();
  unsub = usePlayer.subscribe((s, prev) => {
    if (prev.spielt && !s.spielt) void stoppeAufnahme();
  });
}

export async function stoppeAufnahme(): Promise<void> {
  const st = useAufnahme.getState();
  if (st.phase === 'countdown') {
    abbruch = true;
    st.setze({ phase: 'bereit', countdown: 0 });
    return;
  }
  if (st.phase !== 'laeuft' || !mik || !ziel) return;
  unsub?.();
  unsub = null;
  const z = ziel;
  ziel = null;
  st.setze({ phase: 'speichern' });
  spieler.pausiere();
  try {
    const { blob, mime, dauerMs } = await mik.stoppe();
    // Sofort sichern, bevor irgendetwas anderes passiert
    const row = await speichereAufnahme(blob, mime).catch(() =>
      speichereRoh(blob, mime, dauerMs / 1000),
    );
    useProjekt.getState().aendere('Kommentar aufgenommen', (p) => {
      const clip = p.clips.find((c) => c.id === z.clipId);
      if (!clip) return;
      const gesamt = clipDauer(clip);
      let bevorzugt = st.spurId;
      if (z.ersetzeSegId) {
        const f = findeSegment(clip, z.ersetzeSegId);
        if (f) {
          bevorzugt = f.spur.id;
          f.spur.segmente = f.spur.segmente.filter((s) => s.id !== z.ersetzeSegId);
        }
      }
      const dauer = Math.min(row.dauer, gesamt - z.start);
      if (dauer < 0.1) return;
      spurFuer(clip, z.start, dauer, bevorzugt).segmente.push(segment(row.id, z.start, dauer));
    });
    st.setze({ phase: 'bereit', fehler: null });
  } catch {
    st.setze({ phase: 'bereit', fehler: 'Die Aufnahme konnte nicht gespeichert werden.' });
  }
}
