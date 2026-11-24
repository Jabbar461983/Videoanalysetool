/** Datenmodell nach CLAUDE.md Abschnitt 5. Zeiten in Sekunden der jeweiligen Quelle. */
export const SCHEMA_VERSION = 10;

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
  /** Taktiktafel über dem Video (Anzeigeart und Zeitabschnitte) */
  taktik?: { anzeige: TafelAnzeige; abschnitte: TaktikAbschnitt[] };
}
export type Uebergang = 'schnitt' | 'blende';
/** Eine Seite eines Vergleichs: ein Clip mit Beschriftung und Ankerpunkt (Clip-Zeit in Sekunden, 0 = Clip-Anfang). */
export interface VergleichSeite {
  clipId: string;
  beschriftung: string;
  farbe: string;
  anker: number;
}
export type VergleichAblauf = 'nacheinander' | 'gleichzeitig';
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
    }
  | {
      id: string;
      typ: 'vergleich';
      links: VergleichSeite;
      rechts: VergleichSeite;
      /** nacheinander: erst links, dann rechts (die ruhende Seite ist abgedunkelt); gleichzeitig: beide laufen mit Ankern */
      ablauf: VergleichAblauf;
      /** Am Ende zusätzlich beide gleichzeitig laufen lassen (nur bei «nacheinander») */
      zugabe: boolean;
      /** Pause beim Wechsel der Seite, Sekunden */
      pause: number;
      /** Abdunklung der ruhenden Seite 0–0.8 */
      abdunklung: number;
      /** einpassen = ganzes Bild mit Rand; fuellen = Hälfte füllen, seitlich abschneiden */
      darstellung: 'einpassen' | 'fuellen';
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

/** Taktiktafel (Etappe 9). Feldpositionen in Metern (x entlang der Länge, y quer). */
export interface FeldMasse {
  laenge: number;
  breite: number;
  eckenradius: number;
  torLinieAbstand: number;
  torBreite: number;
  torTiefe: number;
  torraumBreite: number;
  torraumTiefe: number;
  bullyX: number;
  bullyY: number;
  mittelkreisRadius: number;
  /** Abstand der blauen Linien (Drittelslinien) von der roten Mittellinie */
  blaueLinieAbstand: number;
  /** Radius der Bullykreise in den Endzonen */
  bullyKreisRadius: number;
  /** Wie weit ausserhalb des Feldes (m) ein erkannter Spieler noch zählt; Zuschauer hinter der Bande fallen heraus */
  erkennungsRand: number;
  /** vom Verein bestätigt? (Standardwerte sind Platzhalter) */
  geprueft: boolean;
}
export type MarkerArt = 'team1' | 'team2' | 'ball';
export interface TaktikMarker {
  id: string;
  art: MarkerArt;
  x: number;
  y: number;
  nummer?: number;
  name?: string;
}
export type TaktikPfeilArt = 'laufweg' | 'pass' | 'schuss';
export interface TaktikPfeil {
  id: string;
  art: TaktikPfeilArt;
  von: { x: number; y: number };
  nach: { x: number; y: number };
}
export interface Situation {
  id: string;
  name: string;
  marker: TaktikMarker[];
  pfeile: TaktikPfeil[];
  erstelltAm: number;
}
/** Bild (0–1) → Feld (m): Homographie aus Referenzpunkten, gilt für eine Kameraeinstellung. */
export interface Kalibrierung {
  id: string;
  name: string;
  quelleId: string;
  /** Quellzeit des Standbilds, in dem kalibriert wurde */
  zeit: number;
  paare: { punktId?: string; bild: { x: number; y: number }; feld: { x: number; y: number } }[];
  H: [number, number, number, number, number, number, number, number, number];
  rms: number | null;
}
export interface TafelAnzeige {
  modus: 'pip' | 'geteilt' | 'voll';
  ecke: 'ol' | 'or' | 'ul' | 'ur';
  /** Breite der Tafel im Bild-im-Bild als Anteil der Bildbreite (0.2–0.6) */
  groesse: number;
}
/** Zeitspanne (Clip-Zeit), in der die Tafel eingeblendet ist; mit `nachSituationId` gleiten die Marker dorthin. */
export interface TaktikAbschnitt {
  id: string;
  start: number;
  ende: number;
  situationId?: string;
  nachSituationId?: string;
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
    feld: FeldMasse;
    kalibrierungen: Kalibrierung[];
    situationen: Situation[];
    /** zuletzt gewählte Kalibrierung je Quelle */
    aktiveKalibrierung: Record<string, string>;
    /** Vom Nutzer markierte Schiedsrichter-Trikotfarben (RGB): solche Personen werden bei der Erkennung automatisch ausgeschlossen */
    schiedsrichterFarben?: [number, number, number][];
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
