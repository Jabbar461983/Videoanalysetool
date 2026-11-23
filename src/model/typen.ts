/** Datenmodell nach CLAUDE.md Abschnitt 5. Zeiten in Sekunden der jeweiligen Quelle. */
export const SCHEMA_VERSION = 7;

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
  /** Abschnitte (Clip-Zeit), in denen Logo bzw. Scoreboard ausgeblendet sind */
  ausblenden?: { logo: Abschnitt[]; scoreboard: Abschnitt[] };
  /** Tonspuren des Clips (fehlt = Originalton unverändert) */
  audio?: ClipAudio;
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
      /** Logo auf der Titelfolie zeigen (Standard: ja) */
      logo?: boolean;
      uebergang: Uebergang;
    };
export interface Playlist {
  id: string;
  name: string;
  eintraege: PlaylistEintrag[];
}
/** Ab `zeit` in Quelle `quelleId` gilt der feste Stand `stand` (Team 1 : Team 2). */
export interface ScoreKorrektur {
  id: string;
  quelleId: string;
  zeit: number;
  stand: [number, number];
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
/** Rechteck in normierten Bildkoordinaten (0–1). */
export interface NormRahmen {
  x: number;
  y: number;
  b: number;
  h: number;
}
export interface SpielerEffekte {
  spotlight: boolean;
  /** Abdunkelung der Umgebung 0–1 */
  spotlightStaerke: number;
  ring: boolean;
  kontur: boolean;
  lupe: boolean;
  label: boolean;
  /** Beschriftung (z. B. «#7 Meier») */
  text: string;
}
/** Maske zu einem Zeitpunkt (Clip-Zeit); Etappe 8 füllt mehrere Keyframes fürs Tracking. */
export interface MaskenKeyframe {
  zeit: number;
  box: NormRahmen;
  /** Freigestellter Spieler (PNG, Data-URL), genau `box` gross */
  bild: string;
  /** Umgebungsausschnitt (JPEG, Data-URL) für die Lupe, `lupeBox` gross */
  ausschnitt: string;
  lupeBox: NormRahmen;
  /** Mit Hintergrund gefüllte Fläche (PNG, Data-URL) über `box`; nur bei Umplatzieren */
  hintergrund?: string;
  /** Fusspunkt (Mitte unten) normiert */
  fuss: { x: number; y: number };
}
/** Punkt der automatisch verfolgten Spur: Quellzeit in Sekunden, Box normiert (0–1 des Videobilds). */
export interface SpurN {
  zeit: number;
  cx: number;
  cy: number;
  b: number;
  h: number;
  konfidenz: number;
  zustand: 'ok' | 'unsicher' | 'verloren';
}
/** Markierter/verschobener Spieler auf einem Clip. `start`/`ende` in Clip-Zeit (wie Zeichnungen). */
export interface SpielerObjekt {
  id: string;
  clipId: string;
  quelleId: string;
  start: number;
  ende: number;
  trackingModus: 'freeze' | 'auto';
  farbe: string;
  effekte: SpielerEffekte;
  /** Verschiebung gegenüber der Originalposition (normiert), 0/0 = nicht verschoben */
  versatz: { x: number; y: number };
  /** Gestrichelter Pfeil von alter zu neuer Position */
  pfeil: boolean;
  /** Perspektive beim Verschieben: weiter oben im Bild = kleiner (Standard: an, Horizont 0.25) */
  perspektive?: { an: boolean; horizont: number };
  /** Zusätzlicher Grössenfaktor (Standard 1) */
  massstab?: number;
  /** Automatisch verfolgte Spur (nur trackingModus «auto»), Quellzeit */
  spur?: SpurN[];
  /** Quellzeit des Klicks, auf den sich die Maske (maskenKeyframes[0]) bezieht */
  klickZeit?: number;
  maskenKeyframes: MaskenKeyframe[];
}
/** Ein aufgenommenes Stück Kommentar. `start` in Clip-Zeit, `offset`/`dauer` in Sekunden des Blobs. */
export interface AudioSegment {
  id: string;
  blobId: string;
  start: number;
  offset: number;
  dauer: number;
}
export interface KommentarSpur {
  id: string;
  name: string;
  lautstaerke: number;
  stumm: boolean;
  solo: boolean;
  segmente: AudioSegment[];
}
export interface ClipAudio {
  original: { lautstaerke: number; stumm: boolean; solo: boolean };
  ducking: { an: boolean; absenkungDb: number };
  spuren: KommentarSpur[];
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
  overlays: { scoreKorrekturen: ScoreKorrektur[] };
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
    logoAnzeigen: boolean;
    /** Logobreite in % der Bildbreite */
    logoGroesse: number;
    scoreboardAnzeigen: boolean;
    /** Startstand Team 1 : Team 2 */
    startstand: [number, number];
    /** KI-Modell fürs Freistellen (siehe src/ki/modelle.ts) */
    samModell: string;
  };
}
