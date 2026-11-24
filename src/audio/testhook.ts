import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { aktuellerPlan } from '../wiedergabe/transport';
import { holeLogo } from '../render/logo';
import { renderFrame } from '../render/renderFrame';
import { vorschauBilder } from '../render/spielerBilder';
import { spieler } from '../wiedergabe/transport';
import { useProgramm } from '../store/programm';
import { mixdownRender } from './mixdown';
import { audioPlan } from './plan';
import { holeBuffer } from './speicher';

/** Nur für automatische Tests: wird nur geladen, wenn `localStorage['bdva-test'] === '1'`. */
(window as unknown as Record<string, unknown>).__bdvaTest = {
  async mixdownKommentare(): Promise<{ dauer: number; rmsProSekunde: number[]; kanaele: number }> {
    const plan = aktuellerPlan();
    const projekt = useProjekt.getState().projekt;
    if (!plan || !projekt) throw new Error('Kein Programm geöffnet');
    const buf = await mixdownRender(plan, projekt, { sampleRate: 16000, ladeBuffer: holeBuffer });
    const d = buf.getChannelData(0);
    const rms: number[] = [];
    for (let s = 0; s < Math.floor(buf.duration); s++) {
      let q = 0;
      for (let i = s * buf.sampleRate; i < (s + 1) * buf.sampleRate; i++) q += d[i]! * d[i]!;
      rms.push(Math.sqrt(q / buf.sampleRate));
    }
    return { dauer: buf.duration, rmsProSekunde: rms, kanaele: buf.numberOfChannels };
  },
  audioPlan(): unknown {
    const plan = aktuellerPlan();
    const projekt = useProjekt.getState().projekt;
    return plan && projekt ? audioPlan(plan, projekt) : null;
  },
};

/** Verlauf der Abspielposition (nur Tests): hilft, Zeitsprünge zu finden. */
const verlauf: { t: number; zeit: number; spielt: boolean }[] = [];
usePlayer.subscribe((s, prev) => {
  if (s.zeit !== prev.zeit || s.spielt !== prev.spielt)
    verlauf.push({ t: Math.round(performance.now()), zeit: s.zeit, spielt: s.spielt });
});
(window as unknown as Record<string, Record<string, unknown>>).__bdvaTest!.zeitVerlauf = () =>
  verlauf.slice();

const hook = (window as unknown as Record<string, Record<string, unknown>>).__bdvaTest!;
/** Springt im geöffneten Clip/Playlist an die Programmzeit und wartet, bis das Bild steht. */
hook.springe = async (t: number) => {
  await spieler.springe(t);
  await new Promise((r) => setTimeout(r, 150));
};
/**
 * Erwartetes Bild an der aktuellen Programmposition aus der Vorschau: Videobild + frisch mit `renderFrame()` gezeichnete Overlays
 * (Grösse wie im Export). Rückgabe: PNG als Data-URL.
 */
/** Aktueller Projektstand als JSON (nur für Tests). */
hook.projekt = (): unknown => JSON.parse(JSON.stringify(useProjekt.getState().projekt));
hook.vorschauBild = (breite: number, hoehe: number): string => {
  const v = spieler.aktivesElement;
  const projekt = useProjekt.getState().projekt;
  const g = useProgramm.getState();
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, breite, hoehe);
  if (v) ctx.drawImage(v, 0, 0, breite, hoehe);
  const kontext =
    g.art === 'clip'
      ? { art: 'clip' as const, clipId: g.clipId! }
      : { art: 'playlist' as const, playlistId: g.playlistId! };
  renderFrame(usePlayer.getState().zeit, projekt, {
    ctx,
    breite,
    hoehe,
    modus: 'vorschau',
    kontext,
    logo: holeLogo(),
    bilder: vorschauBilder,
  });
  return c.toDataURL('image/png');
};
