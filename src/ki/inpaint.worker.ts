/// <reference lib="webworker" />
/** Inpainting (Telea) mit OpenCV.js; lädt OpenCV erst beim ersten Auftrag. */
interface Auftrag {
  id: number;
  rgba: Uint8ClampedArray;
  b: number;
  h: number;
  maske: Uint8Array;
}
type Cv = {
  Mat: new () => unknown;
  matFromArray: (h: number, b: number, typ: number, d: ArrayLike<number>) => CvMat;
  cvtColor: (a: CvMat, b: CvMat, code: number) => void;
  inpaint: (a: CvMat, m: CvMat, d: CvMat, r: number, art: number) => void;
  CV_8UC4: number;
  CV_8UC3: number;
  CV_8UC1: number;
  COLOR_RGBA2RGB: number;
  COLOR_RGB2RGBA: number;
  INPAINT_TELEA: number;
  onRuntimeInitialized?: () => void;
};
interface CvMat {
  data: Uint8Array;
  delete: () => void;
}
let cvP: Promise<Cv> | null = null;
function ladeCv(): Promise<Cv> {
  cvP ??= (async () => {
    const m = (await import('@techstark/opencv-js')) as unknown as { default: unknown };
    let cv = m.default as Cv | Promise<Cv>;
    if (cv instanceof Promise) cv = await cv;
    if (!cv.Mat) await new Promise<void>((ok) => ((cv as Cv).onRuntimeInitialized = () => ok()));
    return cv as Cv;
  })();
  return cvP;
}

self.onmessage = async (e: MessageEvent<Auftrag>) => {
  const { id, rgba, b, h, maske } = e.data;
  try {
    const cv = await ladeCv();
    const src4 = cv.matFromArray(h, b, cv.CV_8UC4, rgba);
    const src = new cv.Mat() as CvMat;
    cv.cvtColor(src4, src, cv.COLOR_RGBA2RGB);
    const m = cv.matFromArray(h, b, cv.CV_8UC1, maske);
    const dst = new cv.Mat() as CvMat;
    cv.inpaint(src, m, dst, 5, cv.INPAINT_TELEA);
    const dst4 = new cv.Mat() as CvMat;
    cv.cvtColor(dst, dst4, cv.COLOR_RGB2RGBA);
    const aus = new Uint8ClampedArray(dst4.data);
    [src4, src, m, dst, dst4].forEach((x) => x.delete());
    (self as unknown as Worker).postMessage({ id, rgba: aus }, [aus.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      fehler: err instanceof Error ? err.message : String(err),
    });
  }
};
