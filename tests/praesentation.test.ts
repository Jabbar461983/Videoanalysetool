import { describe, expect, it } from 'vitest';
import { aktuellerEintragIndex, zielEintrag } from '../src/praesentation/navigation';

const e = [
  { start: 0, dauer: 3 },
  { start: 3, dauer: 10 },
  { start: 13, dauer: 5 },
];

describe('Präsentation: Navigation', () => {
  it('vorwärts springt zum nächsten Eintrag, nach dem letzten ans Ende', () => {
    expect(zielEintrag(e, 1, 1)).toBe(3);
    expect(zielEintrag(e, 3, 1)).toBe(13);
    expect(zielEintrag(e, 15, 1)).toBe('ende');
  });
  it('rückwärts: erst an den Anfang des Eintrags, kurz nach dem Start zum vorherigen', () => {
    expect(zielEintrag(e, 8, -1)).toBe(3);
    expect(zielEintrag(e, 3.5, -1)).toBe(0);
    expect(zielEintrag(e, 13.2, -1)).toBe(3);
    expect(zielEintrag(e, 0.5, -1)).toBe(0); // am Anfang bleibt es am Anfang
  });
  it('leere Playlist und Position ausserhalb', () => {
    expect(zielEintrag([], 0, 1)).toBeNull();
    expect(zielEintrag(e, 99, -1)).toBe(13);
    expect(aktuellerEintragIndex(e, 3)).toBe(1);
    expect(aktuellerEintragIndex(e, 2.99)).toBe(0);
    expect(aktuellerEintragIndex(e, 99)).toBe(2);
  });
});
