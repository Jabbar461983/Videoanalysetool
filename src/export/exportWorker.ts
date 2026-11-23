/// <reference lib="webworker" />
import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  StreamTarget,
} from 'mediabunny';
import { renderFrame, type RenderKontext } from '../render/renderFrame';
import { baueProgrammPlan } from '../wiedergabe/plan';
import type { Segment } from '../wiedergabe/zeitachse';
import { frameAnzahl, quellZeitFuerFrame } from './format';
import type { ExportAuftrag, WorkerBefehl, WorkerNachricht } from './typen';

let abbruch = false;
const senden = (n: WorkerNachricht, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(n, transfer);

self.onmessage = (e: MessageEvent<WorkerBefehl>) => {
  if (e.data.typ === 'abbruch') abbruch = true;
  else if (e.data.typ === 'start') void laufe(e.data.auftrag);
};

class Abbruch extends Error {}

async function laufe(a: ExportAuftrag): Promise<void> {
  const inputs: Input[] = [];
  let output: Output | null = null;
  try {
    const plan = baueProgrammPlan(
      a.projekt,
      a.art,
      a.art === 'clip' ? a.id : undefined,
      a.art === 'playlist' ? a.id : undefined,
    );
    if (!plan || plan.segmente.length === 0)
      throw new Error('Nichts zu exportieren (leeres Programm).');
    const kontext: RenderKontext =
      a.art === 'clip' ? { art: 'clip', clipId: a.id } : { art: 'playlist', playlistId: a.id };
    const canvas = new OffscreenCanvas(a.breite, a.hoehe);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Zeichenfläche nicht verfügbar.');
    const logo = a.logo
      ? { bild: a.logo.bild, breite: a.logo.breite, hoehe: a.logo.hoehe, platzhalter: false }
      : null;

    // Ausgabe: direkt in Datei oder in den Speicher
    const puffer = a.ziel ? null : new BufferTarget();
    output = new Output({
      format: new Mp4OutputFormat({ fastStart: a.ziel ? false : 'in-memory' }),
      target: a.ziel ? new StreamTarget(a.ziel as WritableStream<never>) : puffer!,
    });
    const videoQuelle = new CanvasSource(canvas, {
      codec: a.videoCodec,
      bitrate: a.bitrate,
      keyFrameInterval: 2,
    });
    output.addVideoTrack(videoQuelle, { frameRate: a.fps });
    const audioQuelle =
      a.audio && a.audioCodec
        ? new AudioSampleSource({ codec: a.audioCodec, bitrate: 128_000 })
        : null;
    if (audioQuelle) output.addAudioTrack(audioQuelle);
    await output.start();

    // Quellen öffnen
    const senken = new Map<string, CanvasSink>();
    const holeSenke = async (id: string): Promise<CanvasSink> => {
      let s = senken.get(id);
      if (s) return s;
      const datei = a.quellen[id];
      if (!datei) throw new Error('Eine Videodatei fehlt.');
      const input = new Input({ source: new BlobSource(datei), formats: ALL_FORMATS });
      inputs.push(input);
      const spur = await input.getPrimaryVideoTrack();
      if (!spur) throw new Error('Die Videodatei enthält kein Bild.');
      if (!(await spur.canDecode())) {
        throw new Error(
          'Das Video kann in diesem Browser nicht decodiert werden. Erzeuge zuerst eine Proxy-Datei (Reiter «Quellen»).',
        );
      }
      s = new CanvasSink(spur, { width: a.breite, height: a.hoehe, fit: 'contain' });
      senken.set(id, s);
      return s;
    };

    const gesamt = frameAnzahl(plan.dauer, a.fps);
    const audioDauer = a.audio ? (a.audio.kanaele[0]?.length ?? 0) / a.audio.sampleRate : 0;
    let audioPos = 0;
    const AUDIO_STUECK = 0.5;
    const schreibeAudio = async (bis: number) => {
      if (!audioQuelle || !a.audio) return;
      const sr = a.audio.sampleRate;
      while (audioPos < bis && audioPos < audioDauer) {
        const von = Math.round(audioPos * sr);
        const bisF = Math.min(
          Math.round((audioPos + AUDIO_STUECK) * sr),
          a.audio.kanaele[0]!.length,
        );
        const n = bisF - von;
        if (n <= 0) break;
        const kanaele = a.audio.kanaele.length;
        const daten = new Float32Array(n * kanaele);
        a.audio.kanaele.forEach((k, c) => daten.set(k.subarray(von, bisF), c * n));
        const sample = new AudioSample({
          format: 'f32-planar',
          sampleRate: sr,
          numberOfChannels: kanaele,
          timestamp: von / sr,
          data: daten,
        });
        await audioQuelle.add(sample);
        sample.close();
        audioPos = bisF / sr;
      }
    };

    // Bild für Bild
    const segs = plan.segmente;
    let si = 0;
    let gen: AsyncGenerator<{ canvas: CanvasImageSource } | null, void, unknown> | null = null;
    let genSeg = -1;
    let letztes: CanvasImageSource | null = null;
    let standbild: OffscreenCanvas | null = null;
    let standbildSeg = -1;

    const frameZeiten = (seg: Segment, i0: number): number[] => {
      const ende = seg.start + seg.dauer;
      const out: number[] = [];
      for (let i = i0; i < gesamt && i / a.fps < ende - 1e-9; i++) {
        out.push(
          quellZeitFuerFrame(i, a.fps, {
            start: seg.start,
            von: seg.von!,
            bis: seg.bis!,
            tempo: seg.tempo!,
          }),
        );
      }
      return out;
    };
    for (let i = 0; i < gesamt; i++) {
      if (abbruch) throw new Abbruch();
      const t = i / a.fps;
      while (si < segs.length - 1 && t >= segs[si]!.start + segs[si]!.dauer - 1e-9) si++;
      const seg = segs[si]!;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, a.breite, a.hoehe);

      if (seg.art === 'video') {
        if (genSeg !== si) {
          const senke = await holeSenke(seg.quelleId!);
          gen = senke.canvasesAtTimestamps(frameZeiten(seg, i)) as unknown as typeof gen;
          genSeg = si;
        }
        const r = await gen!.next();
        if (!r.done && r.value) letztes = r.value.canvas;
        if (letztes) ctx.drawImage(letztes, 0, 0, a.breite, a.hoehe);
      } else if (seg.art === 'freeze') {
        if (standbildSeg !== si) {
          const senke = await holeSenke(seg.quelleId!);
          const w = await senke.getCanvas(seg.zeit!);
          standbild = new OffscreenCanvas(a.breite, a.hoehe);
          if (w) standbild.getContext('2d')!.drawImage(w.canvas, 0, 0, a.breite, a.hoehe);
          standbildSeg = si;
        }
        if (standbild) ctx.drawImage(standbild, 0, 0);
      }

      renderFrame(t, a.projekt, {
        ctx,
        breite: a.breite,
        hoehe: a.hoehe,
        modus: 'export',
        kontext,
        logo,
      });
      await schreibeAudio(t + 1);
      await videoQuelle.add(t, 1 / a.fps);
      if (i % 5 === 0 || i === gesamt - 1) senden({ typ: 'fortschritt', bild: i + 1, gesamt });
    }
    await schreibeAudio(Infinity);
    await output.finalize();
    inputs.forEach((x) => x.dispose());
    const buffer = puffer?.buffer ?? null;
    senden({ typ: 'fertig', buffer, mime: 'video/mp4' }, buffer ? [buffer] : []);
  } catch (e) {
    inputs.forEach((x) => x.dispose());
    try {
      await output?.cancel();
    } catch {
      /* egal */
    }
    if (e instanceof Abbruch) senden({ typ: 'abgebrochen' });
    else senden({ typ: 'fehler', meldung: e instanceof Error ? e.message : String(e) });
  }
}
