import { describe, expect, it } from 'vitest';
import {
  ausgabeGroesse,
  dateiName,
  exportBitrate,
  exportFps,
  formatDauer,
  frameAnzahl,
  quellZeitFuerFrame,
  restzeit,
  waehleCodecs,
} from '../src/export/format';

describe('Export-Format', () => {
  it('Ausgabegrösse: 4K → 1080p, 720p-Ziel, kleiner bleibt, Hochformat, gerade Werte', () => {
    expect(ausgabeGroesse(3840, 2160, 1080)).toEqual({ breite: 1920, hoehe: 1080 });
    expect(ausgabeGroesse(1920, 1080, 720)).toEqual({ breite: 1280, hoehe: 720 });
    expect(ausgabeGroesse(1280, 720, 1080)).toEqual({ breite: 1280, hoehe: 720 }); // nicht hochskaliert
    expect(ausgabeGroesse(640, 360, 1080)).toEqual({ breite: 640, hoehe: 360 });
    expect(ausgabeGroesse(1080, 1920, 1080)).toEqual({ breite: 608, hoehe: 1080 });
    expect(ausgabeGroesse(1441, 1081, 1080).breite % 2).toBe(0);
    expect(ausgabeGroesse(1920, 1440, 1080)).toEqual({ breite: 1440, hoehe: 1080 });
  });
  it('Bildrate: Quelle bis 60, ungültig → 25', () => {
    expect(exportFps(29.97)).toBe(29.97);
    expect(exportFps(120)).toBe(60);
    expect(exportFps(0)).toBe(25);
    expect(exportFps(NaN)).toBe(25);
  });
  it('Bitrate automatisch und begrenzt', () => {
    expect(exportBitrate(1920, 1080, 30)).toBeGreaterThan(4_000_000);
    expect(exportBitrate(1920, 1080, 30)).toBeLessThan(10_000_000);
    expect(exportBitrate(320, 180, 10)).toBe(1_500_000);
    expect(exportBitrate(3840, 2160, 60)).toBe(20_000_000);
  });
  it('Bildanzahl und Quellzeit je Ausgabebild (Zeitlupe, Klemmung)', () => {
    expect(frameAnzahl(10, 30)).toBe(300);
    expect(frameAnzahl(0, 30)).toBe(1);
    const seg = { start: 2, von: 10, bis: 12, tempo: 0.5 };
    expect(quellZeitFuerFrame(60, 30, seg)).toBe(10); // t = 2 s
    expect(quellZeitFuerFrame(90, 30, seg)).toBeCloseTo(10.5); // t = 3 s → 1 s Ausgabe = 0.5 s Quelle
    expect(quellZeitFuerFrame(1000, 30, seg)).toBeLessThan(12); // am Ende gehalten
    expect(quellZeitFuerFrame(0, 30, seg)).toBe(10);
  });
  it('Restzeit und Dauerformat', () => {
    expect(restzeit(0.5, 10)).toBe(10);
    expect(restzeit(0.01, 10)).toBeNull();
    expect(restzeit(0.5, 0.5)).toBeNull();
    expect(formatDauer(75)).toBe('1:15');
    expect(formatDauer(3725)).toBe('1:02:05');
  });
  it('Dateiname ohne Sonderzeichen', () => {
    expect(dateiName('U12: Bulldozers/Horgenberg', 'Tor? 1')).toBe(
      'U12 BulldozersHorgenberg - Tor 1',
    );
    expect(dateiName('', '')).toBe('Export');
  });
  it('Codecwahl mit Ausweichen und Hinweisen', () => {
    expect(waehleCodecs({ avc: true, vp9: true, aac: true, opus: true })).toEqual({
      video: 'avc',
      audio: 'aac',
      hinweise: [],
    });
    const f = waehleCodecs({ avc: false, vp9: true, aac: false, opus: true });
    expect([f.video, f.audio, f.hinweise.length]).toEqual(['vp9', 'opus', 2]);
    expect(waehleCodecs({ avc: false, vp9: false, aac: false, opus: false })).toMatchObject({
      video: null,
      audio: null,
    });
  });
});
