import { SCHEMA_VERSION, type Projekt } from './typen';

export const neueId = (): string => crypto.randomUUID();

export function neuesProjekt(name: string, jetzt = Date.now()): Projekt {
  return {
    id: neueId(),
    name,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
    version: SCHEMA_VERSION,
    quellen: [],
    positionen: {},
    teams: [
      { id: neueId(), kuerzel: 'BUL', name: 'SHC Bulldozers', farbe: '#007057', kader: [] },
      { id: neueId(), kuerzel: 'GEG', name: 'Gegner', farbe: '#BA990E', kader: [] },
    ],
    tagDefinitionen: [],
    tags: [],
    clips: [],
    playlist: [],
    zeichnungen: [],
    spielerObjekte: [],
    overlays: { logo: [], scoreboard: [], scoreKorrekturen: [] },
    audioSpuren: [{ id: neueId(), typ: 'original', lautstaerke: 1, stumm: false, segmente: [] }],
    taktik: { feld: {}, kalibrierungen: [], situationen: [], anzeige: [] },
    einstellungen: { trackingModus: 'auto', exportAufloesung: 1080 },
  };
}

type Migration = (p: Record<string, unknown>) => Record<string, unknown>;
/** Migrationen: Index n wandelt Version n in n+1 um. */
export const migrationen: Migration[] = [];

export function migriere(roh: unknown): Projekt {
  if (typeof roh !== 'object' || roh === null) throw new Error('Ungültiges Projekt');
  let p = { ...(roh as Record<string, unknown>) };
  let v = typeof p.version === 'number' ? p.version : 0;
  if (v > SCHEMA_VERSION) throw new Error('Projekt stammt aus einer neueren App-Version');
  while (v < SCHEMA_VERSION) {
    const m = migrationen[v];
    if (!m) throw new Error(`Keine Migration von Version ${v}`);
    p = m(p);
    v += 1;
    p.version = v;
  }
  return p as unknown as Projekt;
}
