import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { neueId } from '../model/schema';
import type { Quelle } from '../model/typen';

const MB = 1024 * 1024;

/** Teil-Hash: SHA-256 über die ersten und letzten 1 MB (liest nie die ganze Datei). */
export async function berechneTeilHash(datei: Blob): Promise<string> {
  const kopf = await datei.slice(0, MB).arrayBuffer();
  const fuss =
    datei.size > MB
      ? await datei.slice(Math.max(MB, datei.size - MB)).arrayBuffer()
      : new ArrayBuffer(0);
  const alles = new Uint8Array(kopf.byteLength + fuss.byteLength);
  alles.set(new Uint8Array(kopf), 0);
  alles.set(new Uint8Array(fuss), kopf.byteLength);
  const h = await crypto.subtle.digest('SHA-256', alles);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type MetaErgebnis = Pick<Quelle, 'dauer' | 'fps' | 'breite' | 'hoehe' | 'codec'> & {
  abspielbarWebCodecs: boolean;
};

/** Liest nur Header/Index über Mediabunny (kein Volleinlesen). */
export async function leseMetadaten(datei: Blob): Promise<MetaErgebnis> {
  const input = new Input({ source: new BlobSource(datei), formats: ALL_FORMATS });
  try {
    const spur = await input.getPrimaryVideoTrack();
    if (!spur) throw new Error('Keine Videospur');
    const dauer = await input.computeDuration();
    // Nur wenige Pakete auswerten: schnell auch bei 90-Minuten-Dateien.
    const stats = await spur.computePacketStats(200);
    const fps =
      Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0
        ? stats.averagePacketRate
        : 25;
    return {
      dauer,
      fps: Math.round(fps * 1000) / 1000,
      breite: spur.displayWidth,
      hoehe: spur.displayHeight,
      codec: spur.codec ?? 'unbekannt',
      abspielbarWebCodecs: await spur.canDecode().catch(() => false),
    };
  } finally {
    input.dispose();
  }
}

export async function erzeugeQuelle(
  datei: File,
): Promise<{ quelle: Quelle; abspielbarWebCodecs: boolean }> {
  if (
    datei.type &&
    !datei.type.startsWith('video/') &&
    !/\.(mp4|mov|m4v|webm|mkv)$/i.test(datei.name)
  ) {
    throw new Error('KEIN_VIDEO');
  }
  const [teilHash, meta] = await Promise.all([berechneTeilHash(datei), leseMetadaten(datei)]);
  const { abspielbarWebCodecs, ...rest } = meta;
  return {
    quelle: { id: neueId(), dateiname: datei.name, groesse: datei.size, teilHash, ...rest },
    abspielbarWebCodecs,
  };
}

export type Treffer = 'gleich' | 'aehnlich' | 'anders';
/** Erkennung über Name, Grösse und Teil-Hash. */
export async function pruefeDatei(
  q: Pick<Quelle, 'dateiname' | 'groesse' | 'teilHash'>,
  datei: File,
): Promise<Treffer> {
  if (datei.size !== q.groesse) return 'anders';
  const h = await berechneTeilHash(datei);
  if (h !== q.teilHash) return 'anders';
  return datei.name === q.dateiname ? 'gleich' : 'aehnlich';
}
