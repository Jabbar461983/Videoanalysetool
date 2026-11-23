/** Datenmodell nach CLAUDE.md Abschnitt 5. Zeiten in Sekunden der jeweiligen Quelle. */
export const SCHEMA_VERSION = 1;

export interface Quelle {
  id: string;
  dateiname: string;
  groesse: number;
  teilHash: string;
  dauer: number;
  fps: number;
  breite: number;
  hoehe: number;
  codec: string;
  /** Id einer Proxy-Datei (Tabelle proxys), falls der Originalcodec nicht abspielbar ist. */
  proxyId?: string;
}

export interface Spieler {
  id: string;
  nummer: number;
  name: string;
  position: 'verteidiger' | 'stuermer' | 'torhueter';
}
export interface Team {
  id: string;
  kuerzel: string;
  name: string;
  farbe: string;
  kader: Spieler[];
}
export interface TagDef {
  id: string;
  name: string;
  farbe: string;
  hotkey?: string;
  vorlauf: number;
  nachlauf: number;
  istTor: boolean;
}
export interface Tag {
  id: string;
  defId: string;
  quelleId: string;
  zeit: number;
  teamId?: string;
  spielerId?: string;
  notiz?: string;
}
export interface FreezeFrame {
  zeit: number;
  dauer: number;
}
export interface Clip {
  id: string;
  quelleId: string;
  in: number;
  out: number;
  name: string;
  freezeFrames: FreezeFrame[];
}
export type PlaylistEintrag =
  { typ: 'clip'; clipId: string } | { typ: 'titel'; text: string; dauer: number };
export interface Abschnitt {
  start: number;
  ende: number;
}

// Platzhalter-Typen: Inhalt kommt in späteren Etappen, die Felder existieren schon.
export type Zeichnung = {
  id: string;
  quelleId: string;
  start: number;
  ende: number;
  [k: string]: unknown;
};
export type SpielerObjekt = {
  id: string;
  quelleId: string;
  start: number;
  ende: number;
  [k: string]: unknown;
};
export interface AudioSpur {
  id: string;
  typ: 'original' | 'kommentar';
  lautstaerke: number;
  stumm: boolean;
  segmente: { blobId: string; start: number; dauer: number }[];
}

export interface Projekt {
  id: string;
  name: string;
  erstelltAm: number;
  geaendertAm: number;
  version: number;
  quellen: Quelle[];
  aktiveQuelleId?: string;
  /** Letzte Abspielposition je Quelle (Sekunden), damit das Projekt dort weitergeht. */
  positionen: Record<string, number>;
  teams: [Team, Team];
  tagDefinitionen: TagDef[];
  tags: Tag[];
  clips: Clip[];
  playlist: PlaylistEintrag[];
  zeichnungen: Zeichnung[];
  spielerObjekte: SpielerObjekt[];
  overlays: {
    logo: Abschnitt[];
    scoreboard: Abschnitt[];
    scoreKorrekturen: { zeit: number; stand: [number, number] }[];
  };
  audioSpuren: AudioSpur[];
  taktik: {
    feld: Record<string, unknown>;
    kalibrierungen: unknown[];
    situationen: unknown[];
    anzeige: Abschnitt[];
  };
  einstellungen: { trackingModus: 'auto' | 'freeze'; exportAufloesung: 1080 | 720 };
}
