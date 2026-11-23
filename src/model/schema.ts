import { SCHEMA_VERSION, type Projekt } from './typen';
import { neueStandardTags } from '../tagging/standardTags';

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
    tagDefinitionen: neueStandardTags(),
    tags: [],
    clips: [],
    playlisten: [],
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
export const migrationen: Migration[] = [
  // 0 → 1: Vorversion ohne Schema-Nummer, strukturell gleich
  (p) => p,
  // 1 → 2: Tagging – Standard-Tags, Felder sichtbar/fest, Clips mit tagId (optional)
  (p) => {
    const alt = (Array.isArray(p.tagDefinitionen) ? p.tagDefinitionen : []) as Record<
      string,
      unknown
    >[];
    const defs = alt.length
      ? alt.map((d) => ({ sichtbar: true, fest: false, ...d }))
      : neueStandardTags();
    return { ...p, tagDefinitionen: defs };
  },
  // 2 → 3: Schneiden – Playlisten, Zeitlupen
  (p) => {
    const alt = (Array.isArray(p.playlist) ? p.playlist : []) as Record<string, unknown>[];
    const eintraege = alt.map((e) =>
      e.typ === 'titel'
        ? {
            id: neueId(),
            typ: 'titel',
            kicker: '',
            titel: String(e.text ?? ''),
            untertitel: '',
            dauer: Number(e.dauer ?? 3),
            uebergang: 'schnitt',
          }
        : { id: neueId(), typ: 'clip', clipId: e.clipId, uebergang: 'schnitt' },
    );
    const playlisten = eintraege.length ? [{ id: neueId(), name: 'Playlist 1', eintraege }] : [];
    const clips = ((p.clips as Record<string, unknown>[]) ?? []).map((c) => ({
      zeitlupen: [],
      ...c,
    }));
    const rest = { ...p };
    delete rest.playlist;
    return { ...rest, clips, playlisten, aktivePlaylistId: playlisten[0]?.id };
  },
];

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
