import { beforeEach, describe, expect, it } from 'vitest';
import type { SerializedDockview } from 'dockview-react';
import {
  aktualisiereBenanntes,
  benenneBenanntesUm,
  ladeBenannte,
  loescheBenanntes,
  speichereBenanntes,
} from '../src/layout/layouts';
import { istGueltig, PFLICHT_MODULE } from '../src/layout/standard';
import { ladeLayout, speichereLayout } from '../src/layout/speicher';

const layout = (zusatz: string[] = []): SerializedDockview =>
  ({
    grid: {},
    panels: Object.fromEntries([...PFLICHT_MODULE, ...zusatz].map((id) => [id, { id }])),
  }) as unknown as SerializedDockview;

beforeEach(() => localStorage.clear());

describe('Layout: Gültigkeit', () => {
  it('verlangt die Pflichtmodule', () => {
    expect(istGueltig(layout())).toBe(true);
    expect(istGueltig({ panels: { buehne: {} } })).toBe(false);
    expect(istGueltig(null)).toBe(false);
    expect(istGueltig('x')).toBe(false);
  });
  it('zuletzt benutztes Layout: laden/speichern, ungültiges wird ignoriert', () => {
    expect(ladeLayout()).toBeNull();
    speichereLayout(layout(['export']));
    expect(Object.keys(ladeLayout()!.panels)).toContain('export');
    localStorage.setItem('bdva-layout-v1', '{kaputt');
    expect(ladeLayout()).toBeNull();
    localStorage.setItem('bdva-layout-v1', JSON.stringify({ panels: {} }));
    expect(ladeLayout()).toBeNull();
  });
});

describe('Benannte Layouts', () => {
  it('speichern, laden, überschreiben, umbenennen, löschen', () => {
    expect(speichereBenanntes('  Analyse  ', layout())).toEqual({ ok: true, name: 'Analyse' });
    expect(speichereBenanntes('Teamsitzung', layout(['playlist']))).toEqual({
      ok: true,
      name: 'Teamsitzung',
    });
    expect(ladeBenannte().map((x) => x.name)).toEqual(['Analyse', 'Teamsitzung']);
    expect(aktualisiereBenanntes('Analyse', layout(['clips']))).toBe(true);
    expect(Object.keys(ladeBenannte()[0]!.json.panels)).toContain('clips');
    expect(benenneBenanntesUm('Analyse', 'Spielanalyse')).toEqual({ ok: true });
    expect(ladeBenannte().map((x) => x.name)).toEqual(['Spielanalyse', 'Teamsitzung']);
    loescheBenanntes('Spielanalyse');
    expect(ladeBenannte().map((x) => x.name)).toEqual(['Teamsitzung']);
  });

  it('prüft Namen: leer, zu lang, doppelt (auch gross/klein)', () => {
    expect(speichereBenanntes('   ', layout())).toEqual({ ok: false, fehler: 'leer' });
    expect(speichereBenanntes('x'.repeat(41), layout())).toEqual({ ok: false, fehler: 'zuLang' });
    speichereBenanntes('Analyse', layout());
    expect(speichereBenanntes('analyse', layout())).toEqual({ ok: false, fehler: 'vergeben' });
    expect(benenneBenanntesUm('Analyse', 'Analyse')).toEqual({ ok: true }); // eigener Name ist erlaubt
  });

  it('weist ungültige Layouts ab und überspringt beschädigte Einträge', () => {
    expect(speichereBenanntes('Kaputt', { panels: {} } as unknown as SerializedDockview)).toEqual({
      ok: false,
      fehler: 'ungueltig',
    });
    localStorage.setItem(
      'bdva-layouts-v1',
      JSON.stringify([{ name: 'Gut', json: layout() }, { name: 'Schlecht', json: {} }, 7]),
    );
    expect(ladeBenannte().map((x) => x.name)).toEqual(['Gut']);
    localStorage.setItem('bdva-layouts-v1', 'kein json');
    expect(ladeBenannte()).toEqual([]);
  });
});
