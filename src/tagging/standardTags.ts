import type { TagDef } from '../model/typen';

/** Feste Streethockey-Liste (CLAUDE.md 4.2). Ids sind stabil, damit Migrationen und Vorlagen funktionieren. */
const f = (id: string, name: string, farbe: string, hotkey: string, istTor = false): TagDef => ({
  id: `fest-${id}`,
  name,
  farbe,
  hotkey,
  vorlauf: 8,
  nachlauf: 4,
  istTor,
  sichtbar: true,
  fest: true,
});

export const STANDARD_TAGS: TagDef[] = [
  f('tor', 'Tor', '#E0B800', 'G', true),
  f('schuss-tor', 'Schuss aufs Tor', '#2E9E6B', 'A'),
  f('schuss-neben', 'Schuss neben/geblockt', '#7A8F2E', 'N'),
  f('bully-gewonnen', 'Bully gewonnen', '#3A86C8', 'B'),
  f('bully-verloren', 'Bully verloren', '#8E5AB5', 'V'),
  f('strafe', 'Strafe', '#D64545', 'P'),
  f('powerplay', 'Powerplay', '#F28C28', 'W'),
  f('boxplay', 'Boxplay', '#C26A1E', 'X'),
  f('konter', 'Konter', '#17A2B8', 'K'),
  f('torhueter', 'Torhüterparade', '#B0B0B0', 'H'),
  f('ballverlust', 'Ballverlust', '#B5528A', 'U'),
  f('fehler', 'Fehler', '#8A2B2B', 'F'),
];

export const neueStandardTags = (): TagDef[] => STANDARD_TAGS.map((t) => ({ ...t }));

/** Tasten, die die App selbst belegt (jetzt und in späteren Etappen). */
export const RESERVIERTE_TASTEN = [
  'I',
  'O',
  'L',
  'S',
  'T',
  'C',
  'Z',
  'Y',
  'E',
  'D',
  'M',
  ' ',
  '?',
  ',',
  '.',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
];
