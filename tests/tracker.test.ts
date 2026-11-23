import { describe, expect, it } from 'vitest';
import { ByteTracker, ZielVerfolger, iou, type Box, type Erkennung } from '../src/ki/tracker';

const box = (cx: number, cy: number, b = 20, h = 50): Box => ({ cx, cy, b, h });
const det = (cx: number, cy: number, score = 0.9, b = 20, h = 50): Erkennung => ({
  box: box(cx, cy, b, h),
  score,
});

describe('IoU', () => {
  it('identisch 1, getrennt 0, halb überlappend 1/3', () => {
    expect(iou(box(0, 0), box(0, 0))).toBe(1);
    expect(iou(box(0, 0), box(100, 0))).toBe(0);
    expect(iou(box(0, 0, 10, 10), box(5, 0, 10, 10))).toBeCloseTo(1 / 3);
  });
});

describe('ByteTracker', () => {
  it('folgt zwei Spielern mit gleichbleibender Id, auch wenn sie sich kreuzen', () => {
    const t = new ByteTracker();
    // A läuft nach rechts, B nach links, auf unterschiedlicher Höhe
    let a = t.starte(box(100, 100));
    let b = t.starte(box(300, 140));
    for (let i = 1; i <= 40; i++) {
      const s = t.schritt([det(100 + i * 5, 100), det(300 - i * 5, 140)], 0.1);
      expect(s.length).toBe(2);
    }
    a = t.spuren.find((s) => s.id === a.id)!;
    b = t.spuren.find((s) => s.id === b.id)!;
    expect(a.cx).toBeGreaterThan(280);
    expect(b.cx).toBeLessThan(120);
  });

  it('übersteht Aussetzer (Vorhersage) und nimmt die Spur danach wieder auf', () => {
    const t = new ByteTracker();
    const s0 = t.starte(box(100, 100));
    for (let i = 1; i <= 10; i++) t.schritt([det(100 + i * 4, 100)], 0.1);
    for (let i = 11; i <= 14; i++) t.schritt([], 0.1); // vier Bilder ohne Erkennung
    const s = t.spuren.find((x) => x.id === s0.id)!;
    expect(s.fehlt).toBe(4);
    expect(s.cx).toBeGreaterThan(140); // läuft in der Vorhersage weiter
    t.schritt([det(100 + 15 * 4, 100)], 0.1);
    expect(t.spuren.find((x) => x.id === s0.id)!.fehlt).toBe(0);
    expect(t.spuren.length).toBe(1);
  });

  it('schwache Erkennung (Stufe 2) hält eine bestehende Spur, startet aber keine neue', () => {
    const t = new ByteTracker();
    const s0 = t.starte(box(100, 100));
    t.schritt([det(102, 100, 0.25)], 0.1);
    expect(t.spuren.find((x) => x.id === s0.id)!.fehlt).toBe(0);
    const t2 = new ByteTracker();
    t2.schritt([det(50, 50, 0.25)], 0.1);
    expect(t2.spuren.length).toBe(0);
  });

  it('löscht Spuren nach zu vielen Aussetzern', () => {
    const t = new ByteTracker({
      ...{ hoch: 0.5, tief: 0.1, iouHoch: 0.25, iouTief: 0.3, neu: 0.5, alpha: 0.7, beta: 0.3 },
      maxFehlt: 3,
    });
    t.starte(box(10, 10));
    for (let i = 0; i < 5; i++) t.schritt([], 0.1);
    expect(t.spuren.length).toBe(0);
  });
});

describe('ZielVerfolger', () => {
  it('folgt dem gewählten Spieler und ignoriert einen zweiten daneben', () => {
    const v = new ZielVerfolger(box(100, 100));
    let r = v.schritt([], 0.1);
    for (let i = 1; i <= 30; i++) {
      r = v.schritt([det(100 + i * 3, 100), det(260, 100)], 0.1);
    }
    expect(r.zustand).toBe('ok');
    expect(r.box.cx).toBeCloseTo(190, -1);
    expect(r.konfidenz).toBeGreaterThan(0.8);
  });

  it('meldet «verloren», wenn nichts mehr erkannt wird, und behält die letzte Position', () => {
    const v = new ZielVerfolger(box(100, 100));
    for (let i = 0; i < 5; i++) v.schritt([det(100, 100)], 0.1);
    let r = v.schritt([], 0.1);
    expect(r.zustand).toBe('unsicher');
    for (let i = 0; i < 6; i++) r = v.schritt([], 0.1);
    expect(r.zustand).toBe('verloren');
    expect(r.konfidenz).toBeLessThan(0.5);
  });

  it('übernimmt nach Verdeckung eine frische Spur nahe der erwarteten Position', () => {
    const v = new ZielVerfolger(box(100, 100));
    for (let i = 0; i < 5; i++) v.schritt([det(100, 100)], 0.1);
    for (let i = 0; i < 3; i++) v.schritt([], 0.1);
    // Erkennung taucht mit leichtem Versatz wieder auf (zu weit für Stufe 1 der alten Spur ist nicht nötig)
    const r = v.schritt([det(108, 102)], 0.1);
    expect(r.zustand).toBe('ok');
    expect(Math.abs(r.box.cx - 108)).toBeLessThan(12);
  });
});
