import { describe, expect, it } from 'vitest';
import {
  fuegeSpurenZusammen,
  glaette,
  normalisiere,
  spurBei,
  unsichereStellen,
  verlorenAnteil,
  type SpurN,
} from '../src/ki/spur';

const p = (zeit: number, cx: number, zustand: SpurN['zustand'] = 'ok'): SpurN => ({
  zeit,
  cx,
  cy: 0.5,
  b: 0.05,
  h: 0.2,
  konfidenz: zustand === 'ok' ? 1 : 0.3,
  zustand,
});

describe('Spur', () => {
  it('normalisiert Pixel auf 0–1', () => {
    const n = normalisiere(
      [{ zeit: 1, box: { cx: 960, cy: 540, b: 96, h: 216 }, konfidenz: 1, zustand: 'ok' }],
      1920,
      1080,
    );
    expect(n[0]).toMatchObject({ zeit: 1, cx: 0.5, cy: 0.5, b: 0.05, h: 0.2 });
  });
  it('interpoliert linear und klemmt ausserhalb', () => {
    const s = [p(0, 0.2), p(1, 0.4), p(2, 0.4)];
    expect(spurBei(s, 0.5)!.cx).toBeCloseTo(0.3);
    expect(spurBei(s, -5)!.cx).toBe(0.2);
    expect(spurBei(s, 9)!.cx).toBe(0.4);
    expect(spurBei([], 1)).toBeNull();
  });
  it('glättet Ausreisser', () => {
    const s = [p(0, 0.5), p(1, 0.5), p(2, 0.9), p(3, 0.5), p(4, 0.5)];
    const g = glaette(s, 5);
    expect(g[2]!.cx).toBeLessThan(0.65);
    expect(g[0]!.cx).toBeCloseTo(0.5 + 0.4 / 3, 5);
  });
  it('findet unsichere Stellen und den Verlustanteil', () => {
    const s = [
      p(0, 0.1),
      p(0.5, 0.1),
      p(1, 0.1, 'unsicher'),
      p(1.5, 0.1, 'verloren'),
      p(2, 0.1, 'verloren'),
      p(2.5, 0.1),
      p(3, 0.1),
    ];
    const st = unsichereStellen(s);
    expect(st).toEqual([{ von: 1, bis: 2, verloren: true }]);
    expect(verlorenAnteil(s)).toBeCloseTo(2 / 7);
    expect(verlorenAnteil([])).toBe(0);
  });
  it('fügt eine Korrektur-Spur ab ihrem Beginn ein', () => {
    const alt = [p(0, 0.1), p(1, 0.2), p(2, 0.3), p(3, 0.4)];
    const neu = [p(1.5, 0.9), p(2, 0.9), p(3, 0.9)];
    const z = fuegeSpurenZusammen(alt, neu);
    expect(z.map((x) => x.zeit)).toEqual([0, 1, 1.5, 2, 3]);
    expect(z[0]!.cx).toBe(0.1);
    expect(z[4]!.cx).toBe(0.9);
    expect(fuegeSpurenZusammen(alt, [])).toBe(alt);
  });
});
