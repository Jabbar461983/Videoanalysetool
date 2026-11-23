/** Datenmodell nach CLAUDE.md Abschnitt 5. Zeiten in Sekunden der jeweiligen Quelle. */
export const SCHEMA_VERSION = 4;

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
  /** In der Tag-Leiste sichtbar (feste Tags lassen sich nur ausblenden, nicht löschen). */
  sichtbar: boolean;
  fest: boolean;
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
export interface Zeitlupe {
  von: number;
  bis: number;
  /** 0.25 oder 0.5 (Quellzeit läuft mit diesem Tempo) */
  tempo: number;
}
export interface Clip {
  id: string;
  quelleId: string;
  in: number;
  out: number;
  name: string;
  freezeFrames: FreezeFrame[];
  zeitlupen: Zeitlupe[];
  /** Gesetzt, wenn der Clip automatisch aus einem Tag entstanden ist. */
  tagId?: string;
}
export type Uebergang = 'schnitt' | 'blende';
/** `uebergang` gilt beim Wechsel vom vorherigen Eintrag in diesen. */
export type PlaylistEintrag =
  | { id: string; typ: 'clip'; clipId: string; uebergang: Uebergang }
  | {
      id: string;
      typ: 'titel';
      kicker: string;
      titel: string;
      untertitel: string;
      dauer: number;
      uebergang: Uebergang;
    };
export interface Playlist {
  id: string;
  name: string;
  eintraege: PlaylistEintrag[];
}
export interface Abschnitt {
  start: number;
  ende: number;
}

// Platzhalter-Typen: Inhalt kommt in späteren Etappen, die Felder existieren schon.
export type Werkzeug = 'pfeil' | 'linie' | 'freihand' | 'kreis' | 'zone' | 'text' | 'marker';
/** Punkt in normierten Bildkoordinaten (0–1); `d` = Stiftdruck 0–1 (nur Freihand). */
export interface Punkt {
  x: number;
  y: number;
  d?: number;
}
export interface ZeichenStil {
  farbe: string;
  /** Strichstärke in Pixel bei 1920 Bildbreite */
  staerke: number;
  deckkraft: number;
  gestrichelt: boolean;
  spitze: 'ende' | 'beide' | 'keine';
}
export interface ZeichenAnimation {
  ein: 'keine' | 'einblenden' | 'zeichnen';
  dauerEin: number;
  aus: 'keine' | 'ausblenden';
  dauerAus: number;
}
/**
 * Zeichnung auf einem Clip. `start`/`ende` in Clip-Zeit (Sekunden).
 * punkte: pfeil/linie [a, b, (Steuerpunkt)], kreis [Mitte, Mitte+u, Mitte+v], zone/freihand: Punktliste, text/marker [Position].
 */
export interface Zeichnung {
  id: string;
  clipId: string;
  start: number;
  ende: number;
  werkzeug: Werkzeug;
  punkte: Punkt[];
  stil: ZeichenStil;
  animation: ZeichenAnimation;
  text?: string;
  nummer?: number;
}
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
  playlisten: Playlist[];
  aktivePlaylistId?: string;
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
  einstellungen: {
    trackingModus: 'auto' | 'freeze';
    exportAufloesung: 1080 | 720;
    /** Wiedergabe beim Zeichnen automatisch anhalten (Standard: an) */
    zeichnenAnhalten: boolean;
  };
}
