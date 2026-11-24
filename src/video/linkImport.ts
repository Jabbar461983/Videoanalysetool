/**
 * Videos per Link ins Gerät laden. Die Datei geht nie über einen Server der App: Der Browser lädt sie direkt vom
 * angegebenen Server (dieser muss den Abruf per CORS erlauben) und legt sie im Speicher des Browsers ab (OPFS).
 * YouTube-Links werden erkannt, aber nicht geladen (die Nutzungsbedingungen erlauben nur den Download über YouTube Studio).
 */

export type LinkPruefung =
  | { art: 'leer' }
  | { art: 'ungueltig'; grund: 'format' | 'protokoll' | 'nurHttps' }
  | { art: 'youtube'; url: URL; videoId?: string }
  | { art: 'direkt'; url: URL };

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function youtubeVideoId(u: URL): string | undefined {
  if (u.hostname.endsWith('youtu.be')) return u.pathname.split('/')[1] || undefined;
  const v = u.searchParams.get('v');
  if (v) return v;
  const m = /^\/(?:live|shorts|embed|v)\/([^/?#]+)/.exec(u.pathname);
  return m?.[1];
}

/** Einen eingefügten Text prüfen: leer, ungültig, YouTube oder ein direkter Link. */
export function pruefeLink(text: string): LinkPruefung {
  const roh = text.trim();
  if (!roh) return { art: 'leer' };
  let mitSchema = roh;
  // «www.beispiel.ch/video.mp4» ohne Schema ergänzen; andere Schemata (javascript:, data:, file:) nicht anfassen
  if (!/^[a-z][a-z0-9+.-]*:/i.test(roh) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(roh))
    mitSchema = `https://${roh}`;
  let url: URL;
  try {
    url = new URL(mitSchema);
  } catch {
    return { art: 'ungueltig', grund: 'format' };
  }
  if (url.protocol === 'http:') {
    return YOUTUBE_HOSTS.has(url.hostname)
      ? { art: 'youtube', url, videoId: youtubeVideoId(url) }
      : { art: 'ungueltig', grund: 'nurHttps' };
  }
  if (url.protocol !== 'https:') return { art: 'ungueltig', grund: 'protokoll' };
  if (YOUTUBE_HOSTS.has(url.hostname)) return { art: 'youtube', url, videoId: youtubeVideoId(url) };
  return { art: 'direkt', url };
}

const ENDUNG_NACH_TYP: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/x-m4v': '.m4v',
};

/** Dateiname aus Content-Disposition, sonst aus dem Pfad des Links; unzulässige Zeichen werden ersetzt. */
export function dateinameAusLink(
  url: URL,
  contentDisposition?: string | null,
  contentType?: string | null,
): string {
  let name = '';
  const cd = contentDisposition ?? '';
  const utf = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
  const einfach = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
  try {
    if (utf?.[1]) name = decodeURIComponent(utf[1]);
    else if (einfach?.[1]) name = einfach[1];
  } catch {
    name = '';
  }
  if (!name) {
    const letzter = url.pathname.split('/').filter(Boolean).pop() ?? '';
    try {
      name = decodeURIComponent(letzter);
    } catch {
      name = letzter;
    }
  }
  name = Array.from(name.replace(/[\\/:*?"<>|]/g, '_'))
    .map((c) => (c.charCodeAt(0) < 32 ? '_' : c))
    .join('')
    .trim();
  if (!name) name = 'video';
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const typ = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    name += ENDUNG_NACH_TYP[typ] ?? '.mp4';
  }
  return name.slice(0, 120);
}

/** Sieht der Inhaltstyp nach einer Videodatei aus? (Unbekannt gilt als möglich; Webseiten und Text nicht.) */
export function istVideoInhalt(contentType?: string | null): boolean {
  const t = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  if (!t) return true;
  if (t.startsWith('video/')) return true;
  return [
    'application/octet-stream',
    'binary/octet-stream',
    'application/mp4',
    'application/x-matroska',
  ].includes(t);
}

export type LinkFehler = 'netz' | 'http' | 'keinVideo' | 'speicher' | 'zuGross' | 'abgebrochen';
export class LinkImportFehler extends Error {
  constructor(
    readonly art: LinkFehler,
    readonly detail?: string,
  ) {
    super(art);
  }
}

/** Grenze für Browser ohne Dateispeicher (Safari): grössere Videos gar nicht erst im Arbeitsspeicher halten. */
export const MAX_OHNE_DATEISPEICHER = 500 * 1024 * 1024;

type SchreibbareDatei = FileSystemFileHandle & {
  createWritable?: () => Promise<FileSystemWritableFileStream>;
};

async function opfsVideoOrdner(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage?.getDirectory?.();
    return root ? await root.getDirectoryHandle('videos', { create: true }) : null;
  } catch {
    return null;
  }
}

/** Dateien, die dieses Tool im Speicher des Browsers angelegt hat, erkennt man am Namen. */
export const OPFS_PREFIX = 'link-';

export interface LadeOptionen {
  signal?: AbortSignal;
  /** `gesamt` ist null, wenn der Server die Grösse nicht nennt */
  beiFortschritt?: (geladen: number, gesamt: number | null) => void;
}

/** Lädt ein Video von einem direkten Link. Wirft `LinkImportFehler`. */
export async function ladeVideoVonLink(
  url: URL,
  opt: LadeOptionen = {},
): Promise<{ datei: File; handle?: FileSystemFileHandle }> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: opt.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
    });
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') throw new LinkImportFehler('abgebrochen');
    throw new LinkImportFehler('netz', (e as Error)?.message);
  }
  if (!res.ok) throw new LinkImportFehler('http', `${res.status} ${res.statusText}`.trim());
  const typ = res.headers.get('content-type');
  if (!istVideoInhalt(typ)) throw new LinkImportFehler('keinVideo', typ ?? undefined);
  const laenge = Number(res.headers.get('content-length'));
  const gesamt = Number.isFinite(laenge) && laenge > 0 ? laenge : null;
  const name = dateinameAusLink(
    new URL(res.url || url.href),
    res.headers.get('content-disposition'),
    typ,
  );
  if (!res.body) throw new LinkImportFehler('netz', 'keine Daten');

  // Genug Platz?
  try {
    const { quota, usage } = (await navigator.storage?.estimate?.()) ?? {};
    if (gesamt && quota && usage !== undefined && quota - usage < gesamt * 1.02)
      throw new LinkImportFehler('speicher');
  } catch (e) {
    if (e instanceof LinkImportFehler) throw e;
  }

  const dir = await opfsVideoOrdner();
  const eindeutig = `${OPFS_PREFIX}${Date.now().toString(36)}-${name}`;
  const fh = dir
    ? ((await dir.getFileHandle(eindeutig, { create: true })) as SchreibbareDatei)
    : null;
  const reader = res.body.getReader();
  let geladen = 0;

  if (dir && fh && typeof fh.createWritable === 'function') {
    // Direkt auf die Festplatte des Browsers schreiben: nie das ganze Video im Arbeitsspeicher
    const w = await fh.createWritable();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await w.write(value as unknown as FileSystemWriteChunkType);
        geladen += value.length;
        opt.beiFortschritt?.(geladen, gesamt);
      }
      await w.close();
    } catch (e) {
      try {
        await w.abort?.();
      } catch {
        /* egal */
      }
      await dir.removeEntry(eindeutig).catch(() => undefined);
      if ((e as DOMException)?.name === 'AbortError') throw new LinkImportFehler('abgebrochen');
      throw new LinkImportFehler('netz', (e as Error)?.message);
    }
    return { datei: await fh.getFile(), handle: fh };
  }

  // Ohne Dateispeicher (z. B. Safari): nur kleinere Videos über den Arbeitsspeicher
  if (dir && fh) await dir.removeEntry(eindeutig).catch(() => undefined);
  if (gesamt === null || gesamt > MAX_OHNE_DATEISPEICHER) {
    await reader.cancel().catch(() => undefined);
    throw new LinkImportFehler('zuGross');
  }
  const teile: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      teile.push(value);
      geladen += value.length;
      opt.beiFortschritt?.(geladen, gesamt);
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') throw new LinkImportFehler('abgebrochen');
    throw new LinkImportFehler('netz', (e as Error)?.message);
  }
  return { datei: new File(teile as BlobPart[], name, { type: typ ?? 'video/mp4' }) };
}

/** Entfernt eine vom Tool im Browserspeicher angelegte Videodatei (nur Dateien mit dem Tool-Präfix). */
export async function loescheOpfsVideo(handle: FileSystemFileHandle): Promise<void> {
  if (!handle.name.startsWith(OPFS_PREFIX)) return;
  const dir = await opfsVideoOrdner();
  if (!dir) return;
  try {
    const h = await dir.getFileHandle(handle.name);
    if (await h.isSameEntry(handle)) await dir.removeEntry(handle.name);
  } catch {
    /* schon weg */
  }
}
