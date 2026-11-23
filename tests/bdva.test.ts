import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type AudioRow } from '../src/db/db';
import { neuesProjekt } from '../src/model/schema';
import { BdvaFehler, exportiereBdva, importiereBdva } from '../src/projektdatei/bdva';
import { ordneDateienZu } from '../src/projektdatei/zuordnung';
import { berechneTeilHash } from '../src/video/quelle';
import { segment, spurFuer } from '../src/audio/modell';
import type { Projekt, Quelle } from '../src/model/typen';

async function mitQuelle(): Promise<{ p: Projekt; datei: File }> {
  const datei = new File([new Uint8Array(3000).fill(7)], 'halbzeit1.mp4', { type: 'video/mp4' });
  const q: Quelle = {
    id: 'q1',
    dateiname: 'halbzeit1.mp4',
    groesse: datei.size,
    teilHash: await berechneTeilHash(datei),
    dauer: 60,
    fps: 25,
    breite: 1920,
    hoehe: 1080,
    codec: 'avc',
    proxyId: 'proxy-1',
  };
  const p = neuesProjekt('U12 Spiel');
  p.quellen.push(q);
  p.clips.push({
    id: 'c1',
    quelleId: 'q1',
    in: 1,
    out: 9,
    name: 'Clip',
    freezeFrames: [],
    zeitlupen: [],
  });
  return { p, datei };
}

// fake-indexeddb kann Blobs in dieser Testumgebung nicht ablegen: Audio-Tabelle im Speicher nachbilden
const speicher = new Map<string, AudioRow>();
beforeEach(async () => {
  await db.projekte.clear();
  speicher.clear();
  vi.restoreAllMocks();
  vi.spyOn(db.audio, 'get').mockImplementation((async (id: string) => speicher.get(id)) as never);
  vi.spyOn(db.audio, 'put').mockImplementation((async (row: AudioRow) => {
    speicher.set(row.id, row);
    return row.id;
  }) as never);
});

describe('Projektdatei .bdva', () => {
  it('enthält Manifest, Projekt, Aufnahmen und keine Quellvideos/Proxy-Verweise', async () => {
    const { p } = await mitQuelle();
    spurFuer(p.clips[0]!, 0, 2).segmente.push(segment('a1', 0, 2));
    await db.audio.put({
      id: 'a1',
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }),
      mime: 'audio/webm',
      dauer: 2,
      peaks: new Float32Array(200),
      erstelltAm: 1,
    });
    const blob = await exportiereBdva(p);
    const z = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const namen = Object.keys(z);
    expect(namen).toEqual(
      expect.arrayContaining(['manifest.json', 'projekt.json', 'audio.json', 'audio/a1.webm']),
    );
    expect(namen.some((n) => /\.(mp4|mov|mkv)$/i.test(n))).toBe(false);
    expect(JSON.parse(strFromU8(z['manifest.json']!))).toMatchObject({
      format: 'bdva',
      version: 1,
    });
    const projekt = JSON.parse(strFromU8(z['projekt.json']!)) as Projekt;
    expect(projekt.quellen[0]!.proxyId).toBeUndefined();
    expect(Array.from(z['audio/a1.webm']!)).toEqual([1, 2, 3, 4]);
  });

  it('Rundreise: Import legt das Projekt neu an, stellt Aufnahmen wieder her, kopiert bei gleicher Id', async () => {
    const { p } = await mitQuelle();
    spurFuer(p.clips[0]!, 0, 2).segmente.push(segment('a1', 0, 2));
    await db.audio.put({
      id: 'a1',
      blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/webm' }),
      mime: 'audio/webm',
      dauer: 2,
      peaks: new Float32Array(200),
      erstelltAm: 1,
    });
    await db.projekte.put(p);
    const blob = await exportiereBdva(p);

    // Gleiche Id existiert → Kopie
    const kopie = await importiereBdva(blob);
    expect(kopie.id).not.toBe(p.id);
    expect(kopie.name).toBe('U12 Spiel (importiert)');
    expect(kopie.clips[0]!.audio!.spuren[0]!.segmente[0]!.blobId).toBe('a1');

    // Ohne vorhandenes Projekt und ohne Aufnahme in der DB → Aufnahme kommt aus der Datei
    await db.projekte.clear();
    speicher.clear();
    const neu = await importiereBdva(blob);
    expect(neu.id).toBe(p.id);
    expect(neu.name).toBe('U12 Spiel');
    const row = await db.audio.get('a1');
    expect(row?.mime).toBe('audio/webm');
    expect(row?.blob.size).toBe(3);
    expect((await db.projekte.get(neu.id))?.quellen[0]?.dateiname).toBe('halbzeit1.mp4');
  });

  it('lehnt Müll, fremde und neuere Dateien mit verständlicher Meldung ab', async () => {
    await expect(importiereBdva(new Blob(['kein zip']))).rejects.toThrow(BdvaFehler);
    const { zipSync, strToU8 } = await import('fflate');
    const ohne = zipSync({ 'x.txt': strToU8('hi') });
    await expect(importiereBdva(new Blob([ohne as BlobPart]))).rejects.toThrow(/unvollständig/);
    const fremd = zipSync({
      'manifest.json': strToU8('{"format":"anderes","version":1}'),
      'projekt.json': strToU8('{}'),
    });
    await expect(importiereBdva(new Blob([fremd as BlobPart]))).rejects.toThrow(
      /keine Projektdatei/,
    );
    const neuer = zipSync({
      'manifest.json': strToU8('{"format":"bdva","version":99}'),
      'projekt.json': strToU8('{}'),
    });
    await expect(importiereBdva(new Blob([neuer as BlobPart]))).rejects.toThrow(/neueren/);
  });
});

describe('Quellen zuordnen', () => {
  it('erkennt Dateien über Grösse und Teil-Hash, auch bei anderem Namen; ordnet je Datei nur einmal zu', async () => {
    const { p, datei } = await mitQuelle();
    const umbenannt = new File([await datei.arrayBuffer()], 'IMG_0001.MOV');
    const gleichGross = new File([new Uint8Array(3000).fill(1)], 'andere.mp4'); // gleiche Grösse, anderer Inhalt
    const klein = new File([new Uint8Array(10)], 'klein.mp4');
    const r = await ordneDateienZu(p.quellen, [gleichGross, klein, umbenannt]);
    expect(r.zugeordnet).toHaveLength(1);
    expect(r.zugeordnet[0]).toMatchObject({ quelleId: 'q1', treffer: 'aehnlich' });
    expect(r.zugeordnet[0]!.datei).toBe(umbenannt);
    expect(r.uebrig).toEqual([gleichGross, klein]);
    expect(r.ohneDatei).toEqual([]);

    const r2 = await ordneDateienZu(p.quellen, [datei, umbenannt]);
    expect(r2.zugeordnet[0]!.treffer).toBe('gleich');
    const r3 = await ordneDateienZu(p.quellen, [klein]);
    expect(r3.ohneDatei).toEqual(['q1']);
  });
});
