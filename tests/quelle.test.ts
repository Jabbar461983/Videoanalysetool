import { describe, expect, it } from 'vitest';
import { berechneTeilHash } from '../src/video/quelle';

describe('Teil-Hash', () => {
  it('ist stabil, erkennt Änderungen am Anfang und Ende, ignoriert die Mitte', async () => {
    const MB = 1024 * 1024;
    const a = new Uint8Array(5 * MB).fill(1);
    const h1 = await berechneTeilHash(new Blob([a]));
    expect(await berechneTeilHash(new Blob([a]))).toBe(h1);
    const mitte = a.slice();
    mitte[2 * MB] = 9;
    expect(await berechneTeilHash(new Blob([mitte]))).toBe(h1);
    const anfang = a.slice();
    anfang[10] = 9;
    expect(await berechneTeilHash(new Blob([anfang]))).not.toBe(h1);
    const ende = a.slice();
    ende[5 * MB - 10] = 9;
    expect(await berechneTeilHash(new Blob([ende]))).not.toBe(h1);
  });
  it('funktioniert für kleine Dateien', async () => {
    expect((await berechneTeilHash(new Blob(['abc']))).length).toBe(64);
  });
});
