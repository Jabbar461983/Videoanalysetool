/// <reference lib="webworker" />
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import type { KiAntwort, KiBefehl } from './typen';

/**
 * Segment-Anything im Web Worker (transformers.js + onnxruntime-web).
 * Die ONNX-Runtime wird mit der App ausgeliefert; nur die Modellgewichte kommen von Hugging Face
 * und liegen danach im Cache der Seite.
 */
type Tf = typeof import('@huggingface/transformers');
let tf: Tf | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddings: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bildInputs: any = null;
let rohBild: import('@huggingface/transformers').RawImage | null = null;

const senden = (a: KiAntwort, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(a, transfer);

self.onmessage = async (e: MessageEvent<KiBefehl>) => {
  const b = e.data;
  try {
    if (b.typ === 'init') await init(b);
    else if (b.typ === 'einbetten') await einbetten(b.id, b.bild);
    else if (b.typ === 'maske') await maske(b.id, b.punkte);
  } catch (err) {
    senden({
      typ: 'fehler',
      id: 'id' in b ? b.id : undefined,
      meldung: err instanceof Error ? err.message : String(err),
    });
  }
};

async function init(b: Extract<KiBefehl, { typ: 'init' }>) {
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
  const hatGpu = 'gpu' in navigator && b.geraet !== 'wasm';
  const geraete: ('webgpu' | 'wasm')[] = hatGpu ? ['webgpu', 'wasm'] : ['wasm'];
  const progress_callback = (p: {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => {
    if (p.status === 'progress' && p.file) {
      senden({
        typ: 'fortschritt',
        datei: p.file,
        prozent: p.progress ?? 0,
        geladen: p.loaded ?? 0,
        gesamt: p.total ?? 0,
      });
    }
  };
  let letzter: unknown;
  for (const device of geraete) {
    try {
      const Klasse = b.modell.art === 'sam2' ? tf.Sam2Model : tf.SamModel;
      model = await Klasse.from_pretrained(b.modell.repo, {
        dtype: b.modell.dtype as never,
        device,
        progress_callback,
      });
      processor = await tf.AutoProcessor.from_pretrained(b.modell.repo);
      senden({ typ: 'bereit', geraet: device, ladeMs: Math.round(performance.now() - t0) });
      return;
    } catch (err) {
      letzter = err;
    }
  }
  throw letzter instanceof Error ? letzter : new Error(String(letzter));
}

async function einbetten(id: number, bild: ImageBitmap) {
  if (!tf || !model || !processor) throw new Error('Das Modell ist nicht geladen.');
  const t0 = performance.now();
  const oc = new OffscreenCanvas(bild.width, bild.height);
  const ctx = oc.getContext('2d')!;
  ctx.drawImage(bild, 0, 0);
  const d = ctx.getImageData(0, 0, bild.width, bild.height);
  bild.close();
  rohBild = new tf.RawImage(new Uint8ClampedArray(d.data), d.width, d.height, 4).rgb();
  bildInputs = await processor(rohBild);
  embeddings = await model.get_image_embeddings(bildInputs);
  senden({ typ: 'eingebettet', id, ms: Math.round(performance.now() - t0) });
}

async function maske(id: number, punkte: { x: number; y: number; label: 0 | 1 }[]) {
  if (!tf || !model || !processor || !embeddings || !rohBild)
    throw new Error('Kein Bild eingebettet.');
  const t0 = performance.now();
  const input_points = [[punkte.map((p) => [p.x, p.y])]];
  const input_labels = [[punkte.map((p) => p.label)]];
  const inputs = await processor(rohBild, { input_points, input_labels });
  const out = await model({
    ...embeddings,
    input_points: inputs.input_points,
    input_labels: inputs.input_labels,
  });
  const masken = await processor.post_process_masks(
    out.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes,
  );
  const m = masken[0]; // [1, n, H, W] (bool)
  const scores: Float32Array = out.iou_scores.data;
  const n = m.dims[1] as number;
  const h = m.dims[2] as number;
  const w = m.dims[3] as number;
  let best = 0;
  for (let i = 1; i < Math.min(n, scores.length); i++) if (scores[i]! > scores[best]!) best = i;
  const ausschnitt = (m.data as Uint8Array).slice(best * h * w, (best + 1) * h * w);
  const maske = new Uint8Array(ausschnitt.length);
  for (let i = 0; i < ausschnitt.length; i++) maske[i] = ausschnitt[i] ? 255 : 0;
  senden(
    {
      typ: 'maske',
      id,
      maske,
      breite: w,
      hoehe: h,
      score: scores[best] ?? 0,
      ms: Math.round(performance.now() - t0),
    },
    [maske.buffer],
  );
}
