import { describe, expect, it } from 'vitest';
import {
  formatZeit,
  frameZuZeit,
  naechstesTempo,
  schritt,
  vorschauZeiten,
  zeitZuFrame,
} from '../src/video/bildmathe';

describe('Bildmathe', () => {
  it('rechnet Zeit und Frame hin und zurück', () => {
    for (const fps of [25, 29.97, 30, 50, 60]) {
      for (const f of [0, 1, 99, 1234]) expect(zeitZuFrame(frameZuZeit(f, fps), fps)).toBe(f);
    }
  });
  it('schreitet bildweise und bleibt in Grenzen', () => {
    expect(zeitZuFrame(schritt(1, 25, 1, 10), 25)).toBe(26);
    expect(zeitZuFrame(schritt(0, 25, -1, 10), 25)).toBe(0);
    expect(zeitZuFrame(schritt(9.99, 25, 5, 10), 25)).toBe(249);
  });
  it('formatiert Zeit mit Frames', () => {
    expect(formatZeit(61.04, 25)).toBe('01:01:01');
    expect(formatZeit(3600, 25)).toBe('1:00:00:00');
  });
  it('wechselt Tempo in Stufen', () => {
    expect(naechstesTempo(1, 1)).toBe(2);
    expect(naechstesTempo(0.25, -1)).toBe(0.25);
    expect(naechstesTempo(4, 1)).toBe(4);
  });
  it('begrenzt Vorschaubilder', () => {
    expect(vorschauZeiten(0)).toEqual([]);
    expect(vorschauZeiten(5400).length).toBe(200);
    const z = vorschauZeiten(12);
    expect(z.length).toBe(2);
    expect(z.every((x) => x < 12)).toBe(true);
  });
});
