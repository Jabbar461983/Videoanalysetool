import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { benutzteBlobIds } from '../audio/modell';
import { berechnePeaks, PEAKS_PRO_SEKUNDE } from '../audio/peaks';
import { dekodiere } from '../audio/speicher';
import { db, type AudioRow } from '../db/db';
import { migriere, neueId } from '../model/schema';
import { SCHEMA_VERSION, type Projekt } from '../model/typen';

export const BDVA_FORMAT = 'bdva';
export const BDVA_VERSION = 1;

interface Manifest {
  format: typeof BDVA_FORMAT;
  version: number;
  schema: number;
  erstelltAm: number;
  app: string;
}
interface AudioEintrag {
  id: string;
  mime: string;
  dauer: number;
  datei: string;
}

const endung = (mime: string): string =>
  mime.includes('mp4')
    ? 'm4a'
    : mime.includes('ogg')
      ? 'ogg'
      : mime.includes('wav')
        ? 'wav'
        : 'webm';

/** Logo für die Projektdatei (PNG, sonst Platzhalter); Fehler werden ignoriert. */
async function holeLogoDatei(): Promise<{ name: string; daten: Uint8Array } | null> {
  const basis = (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/') as string;
  for (const name of [
    'logo-bulldozers.png',
    'logo-bulldozers_farbig.png',
    'logo-platzhalter.svg',
  ]) {
    try {
      const r = await fetch(`${basis}brand/${name}`);
      const ct = r.headers.get('content-type') ?? '';
      if (r.ok && (ct.startsWith('image/') || name.endsWith('.svg')))
        return { name, daten: new Uint8Array(await r.arrayBuffer()) };
    } catch {
      /* nächster Versuch */
    }
  }
  return null;
}

/** Erzeugt die Projektdatei (ZIP): Projekt, Aufnahmen, Logo – ohne Quellvideos und ohne Proxy-Dateien. */
export async function exportiereBdva(projekt: Projekt, mitLogo = true): Promise<Blob> {
  const kopie: Projekt = JSON.parse(JSON.stringify(projekt));
  for (const q of kopie.quellen) delete q.proxyId;
  const manifest: Manifest = {
    format: BDVA_FORMAT,
    version: BDVA_VERSION,
    schema: SCHEMA_VERSION,
    erstelltAm: Date.now(),
    app: 'Bulldozers Videoanalyse',
  };
  const dateien: Zippable = {
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'projekt.json': strToU8(JSON.stringify(kopie)),
  };
  const audio: AudioEintrag[] = [];
  for (const id of benutzteBlobIds(projekt.clips)) {
    const row = await db.audio.get(id);
    if (!row) continue;
    const datei = `audio/${id}.${endung(row.mime)}`;
    dateien[datei] = [await bytesVon(row.blob), { level: 0 }]; // Audio ist schon komprimiert
    audio.push({ id, mime: row.mime, dauer: row.dauer, datei });
  }
  dateien['audio.json'] = strToU8(JSON.stringify(audio));
  if (mitLogo) {
    const logo = await holeLogoDatei();
    if (logo) dateien[`logos/${logo.name}`] = [logo.daten, { level: 0 }];
  }
  const zip = zipSync(dateien, { level: 6 });
  return new Blob([zip as BlobPart], { type: 'application/zip' });
}

/** Bytes eines Blobs (mit FileReader-Ausweichweg für ältere Umgebungen). */
async function bytesVon(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

export class BdvaFehler extends Error {}

/** Liest eine Projektdatei und legt das Projekt in der lokalen Datenbank an (bei gleicher Id als Kopie). */
export async function importiereBdva(datei: Blob): Promise<Projekt> {
  let entpackt: Record<string, Uint8Array>;
  try {
    entpackt = unzipSync(await bytesVon(datei));
  } catch {
    throw new BdvaFehler('Das ist keine gültige Projektdatei (.bdva).');
  }
  const manifestRoh = entpackt['manifest.json'];
  const projektRoh = entpackt['projekt.json'];
  if (!manifestRoh || !projektRoh)
    throw new BdvaFehler(
      'Die Projektdatei ist unvollständig (manifest.json oder projekt.json fehlt).',
    );
  const manifest = JSON.parse(strFromU8(manifestRoh)) as Manifest;
  if (manifest.format !== BDVA_FORMAT)
    throw new BdvaFehler('Das ist keine Projektdatei dieser App.');
  if (manifest.version > BDVA_VERSION)
    throw new BdvaFehler(
      'Die Projektdatei stammt aus einer neueren App-Version. Aktualisiere die App.',
    );
  let projekt: Projekt;
  try {
    projekt = migriere(JSON.parse(strFromU8(projektRoh)));
  } catch (e) {
    throw new BdvaFehler(
      e instanceof Error ? e.message : 'Das Projekt konnte nicht gelesen werden.',
    );
  }

  // Aufnahmen wiederherstellen
  const audio: AudioEintrag[] = entpackt['audio.json']
    ? JSON.parse(strFromU8(entpackt['audio.json']))
    : [];
  for (const a of audio) {
    const roh = entpackt[a.datei];
    if (!roh) continue;
    const blob = new Blob([roh as BlobPart], { type: a.mime });
    let peaks: Float32Array;
    let dauer = a.dauer;
    try {
      const buffer = await dekodiere(blob);
      peaks = berechnePeaks(buffer, PEAKS_PRO_SEKUNDE);
      dauer = buffer.duration;
    } catch {
      peaks = new Float32Array(Math.ceil(a.dauer * 10)); // Wellenform leer, Ton bleibt erhalten
    }
    const row: AudioRow = { id: a.id, blob, mime: a.mime, dauer, peaks, erstelltAm: Date.now() };
    await db.audio.put(row);
  }

  // Neues Projekt, wenn die Id schon existiert
  if (await db.projekte.get(projekt.id)) {
    projekt.id = neueId();
    projekt.name = `${projekt.name} (importiert)`;
  }
  projekt.geaendertAm = Date.now();
  await db.projekte.put(projekt);
  return projekt;
}
