import { beforeEach, describe, expect, it } from 'vitest';
import { neuesProjekt, migriere } from '../src/model/schema';
import { useProjekt } from '../src/store/projektStore';
import { SCHEMA_VERSION } from '../src/model/typen';

beforeEach(() => useProjekt.getState().oeffne(neuesProjekt('Test')));

describe('Store mit Undo/Redo', () => {
  it('macht Änderungen rückgängig und wiederholt sie', () => {
    const s = useProjekt.getState();
    s.aendere('Name', (p) => {
      p.name = 'A';
    });
    s.aendere('Name', (p) => {
      p.name = 'B';
    });
    expect(useProjekt.getState().projekt?.name).toBe('B');
    useProjekt.getState().undo();
    expect(useProjekt.getState().projekt?.name).toBe('A');
    useProjekt.getState().undo();
    expect(useProjekt.getState().projekt?.name).toBe('Test');
    expect(useProjekt.getState().kannUndo).toBe(false);
    useProjekt.getState().redo();
    expect(useProjekt.getState().projekt?.name).toBe('A');
  });
  it('neue Änderung leert Redo; stille Änderung nicht', () => {
    const s = useProjekt.getState();
    s.aendere('x', (p) => {
      p.name = 'A';
    });
    useProjekt.getState().undo();
    expect(useProjekt.getState().kannRedo).toBe(true);
    useProjekt.getState().aendereStill((p) => {
      p.positionen['q'] = 3;
    });
    expect(useProjekt.getState().kannRedo).toBe(true);
    expect(useProjekt.getState().projekt?.positionen['q']).toBe(3);
    useProjekt.getState().aendere('y', (p) => {
      p.name = 'C';
    });
    expect(useProjekt.getState().kannRedo).toBe(false);
  });
  it('markiert Änderungen als ausstehend', () => {
    useProjekt.getState().aendere('x', (p) => {
      p.name = 'Z';
    });
    expect(useProjekt.getState().status).toBe('ausstehend');
  });
});

describe('Schema', () => {
  it('migriert aktuelle Version unverändert und lehnt neuere ab', () => {
    const p = neuesProjekt('x');
    expect(migriere(p).version).toBe(SCHEMA_VERSION);
    expect(() => migriere({ ...p, version: SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migriere(null)).toThrow();
  });
});
