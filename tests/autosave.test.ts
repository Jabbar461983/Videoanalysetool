import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosaver } from '../src/store/autosave';
import { neuesProjekt } from '../src/model/schema';
import { db } from '../src/db/db';
import {
  dupliziere,
  erstelleProjekt,
  listeProjekte,
  loescheProjekt,
  benenneUm,
  speichereProjekt,
  ladeProjekt,
} from '../src/db/projekte';

describe('Autosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('entprellt, speichert aber spätestens nach 2 s', async () => {
    const speichern = vi.fn().mockResolvedValue(undefined);
    const a = new Autosaver(speichern, 1000, 2000);
    const p = neuesProjekt('x');
    a.melde(p);
    await vi.advanceTimersByTimeAsync(900);
    a.melde({ ...p, name: 'y' });
    await vi.advanceTimersByTimeAsync(900);
    a.melde({ ...p, name: 'z' });
    expect(speichern).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300); // 2100 ms seit der ersten Änderung
    expect(speichern).toHaveBeenCalledTimes(1);
    expect(speichern.mock.calls[0]?.[0].name).toBe('z');
  });
  it('flush speichert sofort', async () => {
    const speichern = vi.fn().mockResolvedValue(undefined);
    const a = new Autosaver(speichern);
    a.melde(neuesProjekt('x'));
    await a.flush();
    expect(speichern).toHaveBeenCalledTimes(1);
  });
});

describe('Projektliste (IndexedDB)', () => {
  beforeEach(async () => {
    await db.projekte.clear();
  });
  it('erstellt, benennt um, dupliziert, löscht', async () => {
    const p = await erstelleProjekt('Spiel 1');
    await benenneUm(p.id, 'Spiel 2');
    const k = await dupliziere(p.id, ' (Kopie)');
    expect(k?.name).toBe('Spiel 2 (Kopie)');
    expect(k?.id).not.toBe(p.id);
    expect((await listeProjekte()).length).toBe(2);
    await loescheProjekt(p.id);
    expect((await listeProjekte()).map((x) => x.id)).toEqual([k?.id]);
  });
  it('speichert und lädt unverändert', async () => {
    const p = neuesProjekt('A');
    await speichereProjekt(p);
    expect(await ladeProjekt(p.id)).toEqual(p);
  });
});
