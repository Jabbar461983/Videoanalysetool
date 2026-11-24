import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LinkImportFehler,
  dateinameAusLink,
  istVideoInhalt,
  ladeVideoVonLink,
  pruefeLink,
  youtubeVideoId,
} from '../src/video/linkImport';
import { istVideoName } from '../src/video/ordnerImport';

describe('Link prüfen', () => {
  it('erkennt YouTube in allen üblichen Formen (auch mit Zusätzen)', () => {
    for (const l of [
      'https://www.youtube.com/live/O-9KUZ-XcPg?is=dKPWX91BX3oRlEeG',
      'https://youtu.be/O-9KUZ-XcPg',
      'https://www.youtube.com/watch?v=O-9KUZ-XcPg&t=12s',
      'https://m.youtube.com/shorts/O-9KUZ-XcPg',
      'youtube.com/watch?v=O-9KUZ-XcPg',
      'http://www.youtube.com/watch?v=O-9KUZ-XcPg',
    ]) {
      const r = pruefeLink(l);
      expect(r.art, l).toBe('youtube');
      if (r.art === 'youtube') expect(r.videoId).toBe('O-9KUZ-XcPg');
    }
    expect(youtubeVideoId(new URL('https://www.youtube.com/embed/abc123'))).toBe('abc123');
  });
  it('direkte Links, fehlendes Schema wird ergänzt', () => {
    const r = pruefeLink('  https://cloud.verein.ch/s/abc/spiel.mp4 ');
    expect(r.art).toBe('direkt');
    expect(pruefeLink('cloud.verein.ch/spiel.mp4').art).toBe('direkt');
  });
  it('lehnt unsichere und unsinnige Eingaben ab', () => {
    expect(pruefeLink('')).toEqual({ art: 'leer' });
    expect(pruefeLink('   ')).toEqual({ art: 'leer' });
    expect(pruefeLink('javascript:alert(1)')).toEqual({ art: 'ungueltig', grund: 'protokoll' });
    expect(pruefeLink('data:text/html,hallo')).toEqual({ art: 'ungueltig', grund: 'protokoll' });
    expect(pruefeLink('file:///etc/passwd')).toEqual({ art: 'ungueltig', grund: 'protokoll' });
    expect(pruefeLink('http://cloud.verein.ch/spiel.mp4')).toEqual({
      art: 'ungueltig',
      grund: 'nurHttps',
    });
    expect(pruefeLink('einfach ein Satz')).toEqual({ art: 'ungueltig', grund: 'format' });
  });
});

describe('Dateiname und Inhalt', () => {
  const u = (s: string) => new URL(s);
  it('Name aus Content-Disposition, sonst aus dem Pfad; Endung ergänzen; gefährliche Zeichen ersetzen', () => {
    expect(dateinameAusLink(u('https://x.ch/a/spiel%201.mp4'))).toBe('spiel 1.mp4');
    expect(
      dateinameAusLink(u('https://x.ch/dl?id=3'), 'attachment; filename="Halbzeit 1.mov"'),
    ).toBe('Halbzeit 1.mov');
    expect(
      dateinameAusLink(u('https://x.ch/dl'), "attachment; filename*=UTF-8''Sp%C3%BCl.mp4"),
    ).toBe('Spül.mp4');
    expect(dateinameAusLink(u('https://x.ch/stream'), null, 'video/webm; codecs=vp9')).toBe(
      'stream.webm',
    );
    expect(dateinameAusLink(u('https://x.ch/'), null, null)).toBe('video.mp4');
    expect(
      dateinameAusLink(u('https://x.ch/dl'), 'attachment; filename="../../etc/pass:wd.mp4"'),
    ).not.toMatch(/[\\/:]/);
  });
  it('Inhaltstyp: Video und unbekannt ja, Webseiten nein', () => {
    expect(istVideoInhalt('video/mp4')).toBe(true);
    expect(istVideoInhalt('application/octet-stream')).toBe(true);
    expect(istVideoInhalt(null)).toBe(true);
    expect(istVideoInhalt('text/html; charset=utf-8')).toBe(false);
    expect(istVideoInhalt('application/json')).toBe(false);
  });
  it('Videodateien im Ordner erkennen', () => {
    expect(['a.MP4', 'b.mov', 'c.webm', 'd.mkv', 'e.m4v'].every(istVideoName)).toBe(true);
    expect(['a.txt', '.hidden.mp4', 'film', 'b.mp4.part'].some(istVideoName)).toBe(false);
  });
});

describe('Laden (ohne Dateispeicher: kleiner Weg über den Arbeitsspeicher)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const antwort = (daten: Uint8Array, kopf: Record<string, string>, status = 200) =>
    new Response(daten as BodyInit, { status, headers: kopf });

  it('lädt ein Video, meldet den Fortschritt und liefert eine Datei mit Namen', async () => {
    const daten = new Uint8Array(3000).fill(7);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort(daten, { 'content-type': 'video/mp4', 'content-length': '3000' })),
    );
    const schritte: number[] = [];
    const r = await ladeVideoVonLink(new URL('https://x.ch/spiel.mp4'), {
      beiFortschritt: (g) => schritte.push(g),
    });
    expect(r.datei.name).toBe('spiel.mp4');
    expect(r.datei.size).toBe(3000);
    expect(schritte.at(-1)).toBe(3000);
  });
  it('Fehler: Webseite statt Video, HTTP-Fehler, Netzfehler (z. B. CORS), unbekannte Grösse', async () => {
    const fehler = async (f: () => Promise<Response>) => {
      vi.stubGlobal('fetch', vi.fn(f));
      return ladeVideoVonLink(new URL('https://x.ch/v.mp4')).catch((e) => e as LinkImportFehler);
    };
    expect(
      (
        (await fehler(async () =>
          antwort(new Uint8Array(5), { 'content-type': 'text/html' }),
        )) as LinkImportFehler
      ).art,
    ).toBe('keinVideo');
    expect(
      ((await fehler(async () => antwort(new Uint8Array(0), {}, 404))) as LinkImportFehler).art,
    ).toBe('http');
    expect(
      (
        (await fehler(async () => {
          throw new TypeError('Failed to fetch');
        })) as LinkImportFehler
      ).art,
    ).toBe('netz');
    expect(
      (
        (await fehler(async () =>
          antwort(new Uint8Array(10), { 'content-type': 'video/mp4' }),
        )) as LinkImportFehler
      ).art,
    ).toBe('zuGross');
  });
  it('Abbruch wird als «abgebrochen» gemeldet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('abgebrochen', 'AbortError');
      }),
    );
    const e = (await ladeVideoVonLink(new URL('https://x.ch/v.mp4')).catch(
      (x) => x,
    )) as LinkImportFehler;
    expect(e.art).toBe('abgebrochen');
  });
});
