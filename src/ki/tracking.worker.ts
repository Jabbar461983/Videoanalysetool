/// <reference lib="webworker" />
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import { ZielVerfolger, type Box, type Erkennung } from './tracker';
import type { SpurPunkt, TrackingAntwort, TrackingBefehl } from './trackingTypen';
import { DETEKTOR_DTYPE, DETEKTOR_DTYPE_GPU, DETEKTOR_REPO, ausschnittFuerBox } from './detektor';

/**
 * Tracking im Worker: Bilder der Clipspanne mit Mediabunny decodieren, um die vorhergesagte Position einen
 * Ausschnitt schneiden, Personen erkennen (RT-DETR v2) und mit dem ByteTrack-Tracker dem gewählten Spieler folgen.
 */
type Tf = typeof import('@huggingface/transformers');
let tf: Tf | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
let geraetGeladen: 'webgpu' | 'wasm' | null = null;
let abbruch = false;
/** Fehlertext, wenn WebGPU nicht geladen werden konnte (für die Diagnose in der Oberfläche) */
let fehlerGpu = '';

const senden = (a: TrackingAntwort) => (self as unknown as Worker).postMessage(a);

async function ladeDetektor(geraet: 'auto' | 'wasm' | 'webgpu'): Promise<'webgpu' | 'wasm'> {
  if (model && geraetGeladen) return geraetGeladen;
  const t0 = performance.now();
  tf ??= await import('@huggingface/transformers');
  tf.env.allowLocalModels = false;
  tf.env.useBrowserCache = true;
  const wasm = tf.env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };
    wasm.numThreads = self.crossOriginIsolated
      ? Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2)))
      : 1;
  }
  let hatGpu = false;
  if ('gpu' in navigator && geraet !== 'wasm') {
    try {
      hatGpu = !!(await (
        navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }
      ).gpu.requestAdapter());
    } catch {
      hatGpu = false;
    }
  }
  const geraete: ('webgpu' | 'wasm')[] = hatGpu ? ['webgpu', 'wasm'] : ['wasm'];
  const progress_callback = (p: {
    status: string;
    file?: string;
    loaded?: number;
    total?: number;
  }) => {
    if (p.status === 'progress' && p.file)
      senden({ typ: 'fortschritt', datei: p.file, geladen: p.loaded ?? 0, gesamt: p.total ?? 0 });
  };
  let letzter: unknown;
  for (const device of geraete) {
    try {
      model = await tf.AutoModelForObjectDetection.from_pretrained(DETEKTOR_REPO, {
        dtype: (device === 'webgpu' ? DETEKTOR_DTYPE_GPU : DETEKTOR_DTYPE) as never,
        device,
        progress_callback,
      });
      processor = await tf.AutoProcessor.from_pretrained(DETEKTOR_REPO);
      geraetGeladen = device;
      senden({ typ: 'bereit', geraet: device, ladeMs: Math.round(performance.now() - t0) });
      return device;
    } catch (err) {
      letzter = err;
      fehlerGpu = device === 'webgpu' ? String((err as Error)?.message ?? err) : fehlerGpu;
    }
  }
  throw letzter instanceof Error ? letzter : new Error(String(letzter));
}

/** Personen in einem 640×640-Ausschnitt (RGBA-Pixel); Boxen in Pixeln des Ausschnitts. */
async function erkenne(
  rgba: Uint8ClampedArray,
  seite: number,
): Promise<{ box: Box; score: number }[]> {
  if (!tf || !model || !processor) throw new Error('Der Detektor ist nicht geladen.');
  const roh = new tf.RawImage(rgba, seite, seite, 4).rgb();
  const inputs = await processor(roh);
  const out = await model(inputs);
  // RT-DETR: Sigmoid je Klasse (kein Softmax), Boxen als (cx, cy, w, h) in 0–1; keine NMS nötig.
  const id2label = model.config.id2label as Record<number, string>;
  const personId = Number(Object.keys(id2label).find((k) => id2label[Number(k)] === 'person') ?? 0);
  const [, anzahl, klassen] = out.logits.dims as number[];
  const logits = out.logits.data as Float32Array;
  const boxen = out.pred_boxes.data as Float32Array;
  const liste: { box: Box; score: number }[] = [];
  for (let j = 0; j < (anzahl ?? 0); j++) {
    const score = 1 / (1 + Math.exp(-logits[j * (klassen ?? 1) + personId]!));
    if (score < 0.1) continue;
    liste.push({
      score,
      box: {
        cx: boxen[j * 4]! * seite,
        cy: boxen[j * 4 + 1]! * seite,
        b: boxen[j * 4 + 2]! * seite,
        h: boxen[j * 4 + 3]! * seite,
      },
    });
  }
  return liste;
}

const SEITE = 640;
const mitte = (liste: number[]) =>
  [...liste].sort((a, b) => a - b)[Math.floor(liste.length / 2)] ?? 0;

/** Erkennt im Ausschnitt um `vorhersage` und liefert Erkennungen in Pixeln des ganzen Bildes. */
async function erkenneImBild(
  canvas: OffscreenCanvas,
  vorhersage: Box,
  seiteVorgabe?: number,
): Promise<{ dets: Erkennung[]; ms: number }> {
  const a = ausschnittFuerBox(canvas.width, canvas.height, vorhersage, seiteVorgabe);
  const tmp = new OffscreenCanvas(SEITE, SEITE);
  const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, a.x, a.y, a.seite, a.seite, 0, 0, SEITE, SEITE);
  const px = ctx.getImageData(0, 0, SEITE, SEITE).data;
  const t0 = performance.now();
  const roh = await erkenne(px, SEITE);
  const ms = performance.now() - t0;
  const f = a.seite / SEITE;
  return {
    ms,
    dets: roh.map((r) => ({
      score: r.score,
      box: { cx: a.x + r.box.cx * f, cy: a.y + r.box.cy * f, b: r.box.b * f, h: r.box.h * f },
    })),
  };
}

/**
 * Rastet die Startbox (z. B. aus einer abgeschnittenen Maske) auf die Personenerkennung am Klickpunkt ein:
 * Erkennung mit dem Punkt im Rahmen, höchstem Score (bei Gleichstand die kleinere). Ohne Treffer bleibt die Startbox.
 */
async function rasteEin(canvas: OffscreenCanvas, start: Box): Promise<Box> {
  const seiten = [undefined, Math.min(canvas.width, canvas.height)];
  const treffer: Erkennung[] = [];
  for (const seite of seiten) {
    const { dets } = await erkenneImBild(canvas, start, seite);
    for (const d of dets) {
      const x0 = d.box.cx - d.box.b / 2;
      const y0 = d.box.cy - d.box.h / 2;
      if (
        d.score >= 0.3 &&
        start.cx >= x0 &&
        start.cx <= x0 + d.box.b &&
        start.cy >= y0 &&
        start.cy <= y0 + d.box.h
      )
        treffer.push(d);
    }
    if (treffer.length) break;
  }
  treffer.sort((p, q) => q.score - p.score || p.box.b * p.box.h - q.box.b * q.box.h);
  return treffer[0]?.box ?? start;
}

async function lauf(b: Extract<TrackingBefehl, { typ: 'start' }>) {
  abbruch = false;
  await ladeDetektor(b.geraet);
  const input = new Input({ source: new BlobSource(b.datei), formats: ALL_FORMATS });
  try {
    const spur = await input.getPrimaryVideoTrack();
    if (!spur || !(await spur.canDecode()))
      throw new Error('Das Video kann nicht decodiert werden.');
    const sink = new CanvasSink(spur);
    let startBox = b.startBox;
    const w0 = await sink.getCanvas(b.startZeit);
    if (w0) startBox = await rasteEin(w0.canvas as OffscreenCanvas, b.startBox);
    const vorwaerts: number[] = [];
    for (let t = b.startZeit + b.schritt; t <= b.bis + 1e-6; t += b.schritt) vorwaerts.push(t);
    const rueckwaerts: number[] = [];
    for (let t = b.startZeit - b.schritt; t >= b.von - 1e-6; t -= b.schritt) rueckwaerts.push(t);
    const gesamt = vorwaerts.length + rueckwaerts.length || 1;
    let fertig = 0;
    const msListe: number[] = [];
    const ergebnis: SpurPunkt[] = [
      { zeit: b.startZeit, box: startBox, konfidenz: 1, zustand: 'ok' },
    ];

    const richtung = async (zeiten: number[], dt: number) => {
      const verfolger = new ZielVerfolger(startBox);
      let i = 0;
      for await (const w of sink.canvasesAtTimestamps(zeiten)) {
        if (abbruch) return;
        const zeit = zeiten[i++] ?? 0;
        if (!w) continue;
        const { dets, ms } = await erkenneImBild(w.canvas as OffscreenCanvas, verfolger.position);
        msListe.push(ms);
        const r = verfolger.schritt(dets, dt);
        const punkt: SpurPunkt = { zeit, box: r.box, konfidenz: r.konfidenz, zustand: r.zustand };
        ergebnis.push(punkt);
        fertig++;
        senden({ typ: 'lauf', anteil: fertig / gesamt, zeit, punkt, ms });
      }
    };
    await richtung(vorwaerts, b.schritt);
    if (!abbruch) await richtung(rueckwaerts, b.schritt);
    ergebnis.sort((p, q) => p.zeit - q.zeit);
    senden({ typ: 'fertig', punkte: ergebnis, abgebrochen: abbruch, medianMs: mitte(msListe) });
  } finally {
    input.dispose();
  }
}

async function schnelltest(geraet: 'auto' | 'wasm' | 'webgpu') {
  const g = await ladeDetektor(geraet);
  const c = new OffscreenCanvas(1280, 720);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e6b34';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#d62828';
  ctx.fillRect(600, 300, 50, 130);
  const zeiten: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { ms } = await erkenneImBild(c, { cx: 625, cy: 365, b: 50, h: 130 });
    if (i > 0) zeiten.push(ms); // erster Lauf zählt nicht (Aufwärmen)
  }
  senden({ typ: 'schnelltest', medianMs: mitte(zeiten), geraet: g, gpuFehler: fehlerGpu });
}

self.onmessage = async (e: MessageEvent<TrackingBefehl>) => {
  const b = e.data;
  try {
    if (b.typ === 'abbrechen') abbruch = true;
    else if (b.typ === 'start') await lauf(b);
    else if (b.typ === 'schnelltest') await schnelltest(b.geraet);
  } catch (err) {
    senden({ typ: 'fehler', meldung: err instanceof Error ? err.message : String(err) });
  }
};
