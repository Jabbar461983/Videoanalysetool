import { db } from '../db/db';
import { neueId } from '../model/schema';

export interface ProxyHandle {
  abbrechen: () => void;
  fertig: Promise<string>;
}

/**
 * Erzeugt eine 1080p-H.264-Proxy-Datei mit ffmpeg.wasm (Single-Thread, lokal ausgeliefert, lazy geladen).
 * Rückgabe: Id des Blobs in der Tabelle `proxys`.
 */
export function erzeugeProxy(
  datei: File,
  dauer: number,
  meldung: (s: 'laedt' | 'laeuft', prozent: number) => void,
): ProxyHandle {
  let abgebrochen = false;
  let ffmpegRef: { terminate: () => void } | null = null;
  const fertig = (async () => {
    meldung('laedt', 0);
    const [{ FFmpeg }, { fetchFile }, coreJs, coreWasm] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
      import('@ffmpeg/core?url'),
      import('@ffmpeg/core/wasm?url'),
    ]);
    const ff = new FFmpeg();
    ffmpegRef = ff;
    ff.on('progress', ({ progress }) =>
      meldung('laeuft', Math.max(0, Math.min(100, Math.round(progress * 100)))),
    );
    await ff.load({ coreURL: coreJs.default, wasmURL: coreWasm.default });
    if (abgebrochen) throw new Error('ABGEBROCHEN');
    meldung('laeuft', 0);
    // Bei sehr grossen Dateien reicht der Arbeitsspeicher evtl. nicht (WASM-Grenze) → Fehler wird gemeldet.
    await ff.writeFile('in', await fetchFile(datei));
    const rc = await ff.exec([
      '-i',
      'in',
      '-vf',
      "scale='min(1920,iw)':-2",
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-t',
      String(Math.ceil(dauer) + 1),
      'out.mp4',
    ]);
    if (rc !== 0) throw new Error('ffmpeg fehlgeschlagen');
    const daten = (await ff.readFile('out.mp4')) as Uint8Array;
    const id = neueId();
    await db.proxys.put({ id, blob: new Blob([daten.slice().buffer], { type: 'video/mp4' }) });
    ff.terminate();
    return id;
  })();
  return {
    abbrechen: () => {
      abgebrochen = true;
      ffmpegRef?.terminate();
    },
    fertig,
  };
}
