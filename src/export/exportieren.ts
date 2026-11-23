import { canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { mixdownRender } from '../audio/mixdown';
import { holeBuffer } from '../audio/speicher';
import { ladeLogo } from '../render/logo';
import { useDateien } from '../store/dateien';
import { useProjekt } from '../store/projektStore';
import { baueProgrammPlan } from '../wiedergabe/plan';
import type { Zeitplan } from '../wiedergabe/zeitachse';
import {
  ausgabeGroesse,
  dateiName,
  exportBitrate,
  exportFps,
  frameAnzahl,
  restzeit,
  waehleCodecs,
  type ExportAufloesung,
} from './format';
import { decodiereOriginalton } from './originalton';
import type { ExportAuftrag, WorkerBefehl, WorkerNachricht } from './typen';

export interface ExportZiel {
  art: 'clip' | 'playlist';
  id: string;
}

export interface ExportPhase {
  phase: 'vorbereitung' | 'ton' | 'video' | 'fertig';
  bild: number;
  gesamt: number;
  verstrichenSek: number;
  restSek: number | null;
}

export interface ExportEinstellungen {
  ziel: ExportZiel;
  aufloesung: ExportAufloesung;
  onPhase: (p: ExportPhase) => void;
  signal?: AbortSignal;
  /** Direkt in diese Datei schreiben (showSaveFilePicker); sonst Download */
  datei?: FileSystemFileHandle | null;
}

export interface Vorabpruefung {
  plan: Zeitplan;
  name: string;
  breite: number;
  hoehe: number;
  fps: number;
  bitrate: number;
  dauer: number;
  bilder: number;
  geschaetzteBytes: number;
  codecs: ReturnType<typeof waehleCodecs>;
  fehlendeQuellen: string[];
}

function planFuer(ziel: ExportZiel): { plan: Zeitplan | null; name: string } {
  const p = useProjekt.getState().projekt;
  if (!p) return { plan: null, name: '' };
  const plan = baueProgrammPlan(
    p,
    ziel.art,
    ziel.art === 'clip' ? ziel.id : undefined,
    ziel.art === 'playlist' ? ziel.id : undefined,
  );
  const objektName =
    ziel.art === 'clip'
      ? p.clips.find((c) => c.id === ziel.id)?.name
      : p.playlisten.find((x) => x.id === ziel.id)?.name;
  return { plan, name: dateiName(p.name, objektName ?? '') };
}

/** Prüft Dateien, Grösse, Bildrate und Codecs, ohne etwas zu exportieren (für die Anzeige im Export-Reiter). */
export async function pruefeExport(
  ziel: ExportZiel,
  aufloesung: ExportAufloesung,
): Promise<Vorabpruefung | null> {
  const projekt = useProjekt.getState().projekt;
  const { plan, name } = planFuer(ziel);
  if (!projekt || !plan || plan.dauer <= 0) return null;
  const dateien = useDateien.getState().dateien;
  const benutzt = new Set(
    plan.segmente.filter((s) => s.art !== 'titel' && s.quelleId).map((s) => s.quelleId!),
  );
  const fehlend = [...benutzt]
    .filter((id) => !dateien[id])
    .map((id) => projekt.quellen.find((q) => q.id === id)?.dateiname ?? id);
  const erste = projekt.quellen.find((q) => benutzt.has(q.id)) ?? projekt.quellen[0];
  const g = erste
    ? ausgabeGroesse(erste.breite, erste.hoehe, aufloesung)
    : ausgabeGroesse(1920, 1080, aufloesung);
  const fps = exportFps(erste?.fps ?? 25);
  const bitrate = exportBitrate(g.breite, g.hoehe, fps);
  const kann = {
    avc: await canEncodeVideo('avc', {
      width: g.breite,
      height: g.hoehe,
      bitrate,
      frameRate: fps,
    }).catch(() => false),
    vp9: await canEncodeVideo('vp9', {
      width: g.breite,
      height: g.hoehe,
      bitrate,
      frameRate: fps,
    }).catch(() => false),
    aac: await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000 }).catch(() => false),
    opus: await canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: 48000 }).catch(
      () => false,
    ),
  };
  return {
    plan,
    name,
    ...g,
    fps,
    bitrate,
    dauer: plan.dauer,
    bilder: frameAnzahl(plan.dauer, fps),
    geschaetzteBytes: Math.round(((bitrate + 128_000) * plan.dauer) / 8),
    codecs: waehleCodecs(kann),
    fehlendeQuellen: fehlend,
  };
}

export class ExportFehler extends Error {}

/** Führt den Export aus. Gibt bei Download den Dateinamen zurück; bei Direktspeicherung ebenfalls. */
export async function exportiereVideo(
  opt: ExportEinstellungen,
): Promise<{ dateiname: string; ort: 'datei' | 'download'; bytes: number }> {
  const start = performance.now();
  const meldung = (phase: ExportPhase['phase'], bild = 0, gesamt = 0) => {
    const verstrichen = (performance.now() - start) / 1000;
    opt.onPhase({
      phase,
      bild,
      gesamt,
      verstrichenSek: verstrichen,
      restSek: phase === 'video' ? restzeit(gesamt ? bild / gesamt : 0, verstrichen) : null,
    });
  };
  console.log('[export] start');
  meldung('vorbereitung');
  const v = await pruefeExport(opt.ziel, opt.aufloesung);
  const projekt = useProjekt.getState().projekt;
  if (!v || !projekt)
    throw new ExportFehler('Es gibt nichts zu exportieren: Der Clip bzw. die Playlist ist leer.');
  if (v.fehlendeQuellen.length)
    throw new ExportFehler(
      `Videodatei fehlt: ${v.fehlendeQuellen.join(', ')}. Ordne sie im Reiter «Quellen» zu.`,
    );
  if (!v.codecs.video)
    throw new ExportFehler(
      'Dieser Browser kann kein Video kodieren (WebCodecs). Verwende Chrome oder Edge.',
    );
  const dateien = useDateien.getState().dateien;
  console.log('[export] geprueft');

  // Ton auf dem Hauptthread mischen (Web Audio gibt es im Worker nicht)
  let audio: ExportAuftrag['audio'] = null;
  if (v.codecs.audio) {
    meldung('ton');
    const mix = await mixdownRender(v.plan, projekt, {
      sampleRate: 48000,
      ladeBuffer: holeBuffer,
      original: async (seg) => {
        const datei = seg.quelleId ? dateien[seg.quelleId] : undefined;
        return datei ? decodiereOriginalton(datei, seg.von!, seg.bis!) : null;
      },
    });
    audio = {
      sampleRate: mix.sampleRate,
      kanaele: Array.from({ length: mix.numberOfChannels }, (_, c) =>
        mix.getChannelData(c).slice(),
      ),
    };
  }
  console.log('[export] ton fertig');
  if (opt.signal?.aborted) throw new ExportFehler('abgebrochen');

  const bild = await ladeLogo();
  const logo = bild
    ? {
        bild: await createImageBitmap(bild.bild as HTMLImageElement),
        breite: bild.breite,
        hoehe: bild.hoehe,
      }
    : null;

  const quellen: Record<string, File> = {};
  for (const s of v.plan.segmente)
    if (s.quelleId && dateien[s.quelleId]) quellen[s.quelleId] = dateien[s.quelleId]!;

  let schreiber: FileSystemWritableFileStream | null = null;
  if (opt.datei) schreiber = await opt.datei.createWritable();

  const auftrag: ExportAuftrag = {
    projekt: JSON.parse(JSON.stringify(projekt)),
    art: opt.ziel.art,
    id: opt.ziel.id,
    quellen,
    breite: v.breite,
    hoehe: v.hoehe,
    fps: v.fps,
    bitrate: v.bitrate,
    videoCodec: v.codecs.video,
    audioCodec: audio ? v.codecs.audio : null,
    audio,
    logo,
    ziel: schreiber as unknown as WritableStream | null,
  };
  const transfer: Transferable[] = [];
  if (logo) transfer.push(logo.bild);
  audio?.kanaele.forEach((k) => transfer.push(k.buffer));
  if (schreiber) transfer.push(schreiber as unknown as Transferable);

  console.log('[export] worker starten');
  const worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' });
  try {
    const ergebnis = await new Promise<{ buffer: ArrayBuffer | null }>((resolve, reject) => {
      const abbruch = () => worker.postMessage({ typ: 'abbruch' } satisfies WorkerBefehl);
      opt.signal?.addEventListener('abort', abbruch);
      worker.onmessage = (e: MessageEvent<WorkerNachricht>) => {
        const n = e.data;
        console.log('[export] worker', n.typ);
        if (n.typ === 'fortschritt') meldung('video', n.bild, n.gesamt);
        else if (n.typ === 'fertig') resolve({ buffer: n.buffer });
        else if (n.typ === 'abgebrochen') reject(new ExportFehler('abgebrochen'));
        else reject(new ExportFehler(n.meldung));
      };
      worker.onerror = (e) => reject(new ExportFehler(e.message || 'Der Export ist abgestürzt.'));
      worker.postMessage({ typ: 'start', auftrag } satisfies WorkerBefehl, transfer);
    });
    meldung('fertig', v.bilder, v.bilder);
    const dateiname = `${v.name}.mp4`;
    if (ergebnis.buffer) {
      ladeHerunter(new Blob([ergebnis.buffer], { type: 'video/mp4' }), dateiname);
      return { dateiname, ort: 'download', bytes: ergebnis.buffer.byteLength };
    }
    return { dateiname: opt.datei?.name ?? dateiname, ort: 'datei', bytes: v.geschaetzteBytes };
  } catch (e) {
    // Angefangene Datei entfernen, wenn möglich
    if (opt.datei)
      await (opt.datei as FileSystemFileHandle & { remove?: () => Promise<void> })
        .remove?.()
        .catch(() => {});
    throw e;
  } finally {
    worker.terminate();
  }
}

export function ladeHerunter(blob: Blob, dateiname: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Ab dieser geschätzten Grösse wird (wenn möglich) direkt in eine Datei geschrieben. */
export const DIREKT_SPEICHERN_AB_BYTES = 150 * 1024 * 1024;

export async function waehleZieldatei(vorschlag: string): Promise<FileSystemFileHandle | null> {
  const w = window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>;
  };
  if (!w.showSaveFilePicker) return null;
  return w.showSaveFilePicker({
    suggestedName: `${vorschlag}.mp4`,
    types: [{ description: 'MP4-Video', accept: { 'video/mp4': ['.mp4'] } }],
  });
}
