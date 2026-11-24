import type { DockviewApi, IDockviewPanel } from 'dockview-react';

/** Alle Module der Arbeitsfläche. Reihenfolge = Reihenfolge der Register im Standardlayout. */
export const MODULE = [
  { id: 'buehne', titel: 'Video', fest: true },
  { id: 'taglesite', titel: 'Tag-Leiste', fest: false },
  { id: 'zeit', titel: 'Zeitleiste', fest: true },
  { id: 'quellen', titel: 'Quellen', fest: false },
  { id: 'tags', titel: 'Tags', fest: false },
  { id: 'clips', titel: 'Clips', fest: false },
  { id: 'playlist', titel: 'Playlist', fest: false },
  { id: 'taktik', titel: 'Taktik', fest: false },
  { id: 'setup', titel: 'Setup', fest: false },
  { id: 'export', titel: 'Export', fest: false },
] as const;
export type ModulId = (typeof MODULE)[number]['id'];
export const SEITEN_MODULE: ModulId[] = [
  'quellen',
  'tags',
  'clips',
  'playlist',
  'taktik',
  'setup',
  'export',
];
/** Module, die immer da sein müssen (Wiedergabe und Zeitachse); das Layout ist sonst ungültig. */
export const PFLICHT_MODULE: ModulId[] = MODULE.filter((m) => m.fest).map((m) => m.id);

export const modulTitel = (id: string): string => MODULE.find((m) => m.id === id)?.titel ?? id;

/** Das Standardlayout: Video links gross, darunter Tag-Leiste, rechts die Register, unten die Zeitleiste. */
export function baueStandardLayout(api: DockviewApi, breite: number, hoehe: number): void {
  api.clear();
  const buehne = api.addPanel({
    id: 'buehne',
    component: 'buehne',
    title: modulTitel('buehne'),
    renderer: 'always',
  });
  let erstes: IDockviewPanel | null = null;
  for (const id of SEITEN_MODULE) {
    const p: IDockviewPanel = api.addPanel({
      id,
      component: id,
      title: modulTitel(id),
      position: erstes
        ? { referencePanel: erstes, direction: 'within' }
        : { referencePanel: buehne, direction: 'right' },
    });
    erstes ??= p;
  }
  api.addPanel({
    id: 'taglesite',
    component: 'taglesite',
    title: modulTitel('taglesite'),
    position: { referencePanel: buehne, direction: 'below' },
  });
  api.addPanel({
    id: 'zeit',
    component: 'zeit',
    title: modulTitel('zeit'),
    renderer: 'always',
    position: { direction: 'below' },
  });
  // Grössen: Seitenleiste ≈ 32 % (420–560 px), Zeitleiste und Tag-Leiste so hoch wie ihr Inhalt
  const seite = Math.max(420, Math.min(560, Math.round(breite * 0.32)));
  erstes?.group.api.setSize({ width: seite });
  api.getPanel('zeit')?.group.api.setSize({ height: Math.min(240, Math.round(hoehe * 0.34)) });
  api.getPanel('taglesite')?.group.api.setSize({ height: 112 });
  erstes?.api.setActive();
  buehne.api.setActive();
  erstes?.api.setActive();
}

/** Prüft, ob ein gespeichertes Layout alle Pflichtmodule enthält. */
export function istGueltig(json: unknown): boolean {
  if (typeof json !== 'object' || json === null) return false;
  const panels = (json as { panels?: Record<string, unknown> }).panels;
  if (!panels || typeof panels !== 'object') return false;
  return PFLICHT_MODULE.every((id) => id in panels);
}
