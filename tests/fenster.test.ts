import { describe, expect, it, vi } from 'vitest';
import { aufAllenFenstern, registriereFenster } from '../src/layout/fenster';
import { holeHauptVideo, setzeHauptVideo } from '../src/layout/bildquelle';

/** Ein «Fenster» reicht für die Tests: Hauptsache, es kann Ereignisse empfangen. */
const neuesFenster = () => new EventTarget() as unknown as Window;
const taste = (w: Window, key: string) =>
  (w as unknown as EventTarget).dispatchEvent(Object.assign(new Event('keydown'), { key }));

describe('Fensterregister', () => {
  it('Listener gilt im Hauptfenster und in später angemeldeten Fenstern', () => {
    const fn = vi.fn();
    const aus = aufAllenFenstern('keydown', fn);
    taste(window, 'a');
    const popup = neuesFenster();
    const ab = registriereFenster(popup);
    taste(popup, 'b');
    expect(fn).toHaveBeenCalledTimes(2);
    ab();
    taste(popup, 'c'); // abgemeldetes Fenster: nichts mehr
    expect(fn).toHaveBeenCalledTimes(2);
    aus();
    taste(window, 'd');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('Bestehende Abonnements werden an neue Fenster gehängt, Abmelden entfernt sie wieder', () => {
    const fn = vi.fn();
    const popup = neuesFenster();
    const ab = registriereFenster(popup);
    const aus = aufAllenFenstern('keydown', fn);
    taste(popup, 'x');
    expect(fn).toHaveBeenCalledTimes(1);
    aus();
    taste(popup, 'y');
    expect(fn).toHaveBeenCalledTimes(1);
    ab();
  });

  it('Doppelt angemeldetes Fenster ruft den Listener nur einmal', () => {
    const fn = vi.fn();
    const popup = neuesFenster();
    const ab1 = registriereFenster(popup);
    registriereFenster(popup);
    const aus = aufAllenFenstern('keydown', fn);
    taste(popup, 'z');
    expect(fn).toHaveBeenCalledTimes(1);
    aus();
    ab1();
  });
});

describe('Bildquelle', () => {
  it('liefert das angemeldete Video, sonst das erste im Dokument', () => {
    const v = document.createElement('video');
    setzeHauptVideo(v);
    expect(holeHauptVideo()).toBe(v);
    setzeHauptVideo(null);
    expect(holeHauptVideo()).toBeNull();
    const d = document.createElement('video');
    document.body.appendChild(d);
    expect(holeHauptVideo()).toBe(d);
    d.remove();
  });
});
