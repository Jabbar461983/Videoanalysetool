import { holeLogo } from '../render/logo';
import { ladeSpielerBilder, vorschauBilder } from '../render/spielerBilder';
import { renderFrame, type RenderKontext } from '../render/renderFrame';
import { zeichneVergleichBilder } from '../render/vergleich';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { findeSegmentIndex } from '../wiedergabe/zeitachse';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { spieler } from '../wiedergabe/transport';
import { dateiName } from './format';
import { ladeHerunter } from './exportieren';

/**
 * Das aktuelle Bild als PNG inkl. aller Overlays (dieselbe `renderFrame()`-Funktion wie Vorschau und Export).
 * Auflösung: Videobreite, höchstens 1920.
 */
export async function exportiereAktuellesBild(): Promise<string | null> {
  const projekt = useProjekt.getState().projekt;
  const g = useProgramm.getState();
  if (!projekt) return null;
  const quelleId =
    g.art === 'quelle'
      ? (projekt.aktiveQuelleId ?? projekt.quellen[0]?.id)
      : (g.anzeigeQuelleId ?? projekt.quellen[0]?.id);
  const quelle = projekt.quellen.find((q) => q.id === quelleId);
  const video = g.art === 'quelle' ? document.querySelector('video') : spieler.aktivesElement;
  if (!quelle || !video) return null;
  const breite = Math.min(1920, quelle.breite);
  const hoehe = Math.round((breite * quelle.hoehe) / quelle.breite);
  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, breite, hoehe);
  const tVor = g.art === 'quelle' ? 0 : usePlayer.getState().zeit;
  const plan = g.art === 'quelle' ? null : baueProgrammPlan(projekt, g.art, g.clipId, g.playlistId);
  const seg = plan?.segmente[findeSegmentIndex(plan.segmente, tVor)];
  const beide = spieler.elemente;
  if (seg?.art === 'vergleich' && seg.vergleich && beide) {
    // Vergleich: beide Seiten aus den beiden Videoelementen
    const mk = (el: HTMLVideoElement) =>
      el.readyState >= 2 && el.videoWidth
        ? { bild: el, breite: el.videoWidth, hoehe: el.videoHeight }
        : null;
    zeichneVergleichBilder(ctx, breite, hoehe, seg.vergleich, mk(beide[0]), mk(beide[1]));
  } else if (video.readyState >= 2) ctx.drawImage(video, 0, 0, breite, hoehe);
  const kontext: RenderKontext =
    g.art === 'clip' && g.clipId
      ? { art: 'clip', clipId: g.clipId }
      : g.art === 'playlist' && g.playlistId
        ? { art: 'playlist', playlistId: g.playlistId }
        : { art: 'quelle', quelleId };
  const t = g.art === 'quelle' ? video.currentTime : usePlayer.getState().zeit;
  await ladeSpielerBilder(projekt, vorschauBilder);
  renderFrame(t, projekt, {
    ctx,
    breite,
    hoehe,
    modus: 'export',
    kontext,
    logo: holeLogo(),
    bilder: vorschauBilder,
  });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return null;
  const sek = Math.floor(t);
  const name =
    dateiName(projekt.name, `Bild ${Math.floor(sek / 60)}-${String(sek % 60).padStart(2, '0')}`) +
    '.png';
  ladeHerunter(blob, name);
  return name;
}
