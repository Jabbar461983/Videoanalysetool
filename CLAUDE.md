# CLAUDE.md – Bulldozers Videoanalyse

Dieses Dokument ist der Master-Prompt und die verbindliche Projektbeschreibung. Lies es vor jeder Etappe vollständig. Die einzelnen Etappen stehen in `docs/ETAPPEN-PROMPTS.md`, der aktuelle Stand in `docs/STATUS.md`.

---

## 1. Ziel

Ein Video-Analysetool für **Streethockey**, entwickelt für die Coaches des **SHC Bulldozers Kernenried-Zauggenried**. Coaches laden Spielvideos, markieren Szenen, zeichnen Taktik auf das Video, heben Spieler hervor oder verschieben sie, kommentieren per Mikrofon und exportieren Einzelclips sowie ein zusammengestelltes Gesamtvideo für die Teamsitzung.

Vorbilder für den Funktionsumfang: Hudl Sportscode (Tagging, Timeline, Playlists), Coach Paint (Telestration, Spieler freistellen, Spieler verschieben, Tracking), Metrica Play (Spotlight mit Tracking), KlipDraw/Kinovea (Zeichenwerkzeuge). Wir bauen eine schlanke, vereinstaugliche Variante, keine Kopie.

**Nutzer:** Coaches (Spielanalyse, Vorbereitung Teamsitzung). Kein Login, keine Spieler- oder Elternzugänge.
**Einsatz:** Laptop mit Maus und Tastatur, Convertible mit Touch und Stift, Tablet (iPad/Android), Beamer/TV im Teamraum.

---

## 2. Grundsatzentscheide (nicht ändern ohne Rückfrage)

1. **100 % im Browser, kein Server.** Videos verlassen das Gerät nie. Hosting als statische Seite auf **GitHub Pages**. Es gibt kein Backend, keine Datenbank in der Cloud und keine Analytics. Einzige Netzwerkzugriffe: das Laden der App selbst und der KI-Modelle (danach im Cache).
2. **Eine Render-Funktion für Vorschau und Export.** Alles, was über das Video gelegt wird (Zeichnungen, Spotlight, verschobene Spieler, Logo, Scoreboard, Taktiktafel, Titelfolien), wird von *derselben* Compositing-Funktion gezeichnet: in der Vorschau live auf ein Canvas, im Export Frame für Frame. Was man sieht, wird exportiert.
3. **Nicht-destruktiv.** Das Originalvideo wird nie verändert. Clips, Zeichnungen, Audio und Overlays sind Daten im Projekt, die auf Zeitpunkte im Quellvideo verweisen.
4. **Grosse Dateien sind der Normalfall.** Ganze Spiele (60–90 Min., mehrere GB, 1080p oder 4K, MP4/MOV, H.264/HEVC) müssen laufen. Videos werden nie vollständig in den Arbeitsspeicher geladen.
5. **Automatisches Zwischenspeichern ist Pflicht.** Jede Änderung wird lokal (IndexedDB) gesichert. Ein Absturz oder ein geschlossener Tab darf höchstens die letzten Sekunden Arbeit kosten.
6. **Die KI ist eine Zugabe, kein Fundament.** Alle Grundfunktionen (Etappen 0–6) funktionieren ohne KI. KI-Funktionen werden erst geladen, wenn sie gebraucht werden, und haben immer einen manuellen Ausweichweg.
7. **Benutzeroberfläche auf Deutsch (Schweiz):** «ss» statt «ß», Guillemets «…», kurze klare Bezeichnungen. Alle Texte in einer Datei (`src/i18n/de-CH.ts`), damit später weitere Sprachen möglich sind.

---

## 3. Technik-Stack

| Bereich | Wahl | Hinweis |
|---|---|---|
| Build | Vite + React 18+ + TypeScript (strict) | `base` für GitHub Pages setzen |
| State | Zustand (+ Immer) | Undo/Redo über eine Command-History |
| Styling | CSS-Variablen aus den Design-Tokens + CSS Modules | keine UI-Bibliothek mit eigenem Look |
| Video lesen/schreiben | **Mediabunny** (WebCodecs-basiert: Demux, Decode, Encode, MP4-Mux) | Fallback **ffmpeg.wasm** nur für nicht unterstützte Codecs (Proxy-Datei erzeugen) |
| Wiedergabe | `<video>` mit Object-URL der Datei + `requestVideoFrameCallback` | bildgenaues Springen über Mediabunny |
| Compositing | Canvas 2D bzw. OffscreenCanvas im Web Worker | gemeinsame Funktion `renderFrame(t, projekt, ziel)` |
| Audio | Web Audio API, `MediaRecorder` (Mikrofon), `OfflineAudioContext` (Mixdown für Export) | |
| Lokale Speicherung | IndexedDB über Dexie; File System Access API (wo vorhanden) | Datei-Handles merken, um Videos wieder zu verknüpfen |
| Projektdatei | ZIP (fflate) mit `projekt.json` + Audioaufnahmen + Logos, **ohne** Quellvideo | Endung `.bdva` |
| KI-Laufzeit | onnxruntime-web (WebGPU, Fallback WASM) bzw. transformers.js | Modelle lazy laden, im Cache API speichern |
| Freistellen | Segment-Anything-Variante, die im Browser läuft (z. B. SlimSAM, MobileSAM, EfficientSAM oder SAM 2 tiny) | Wahl in Etappe 7 nach Benchmark begründen |
| Hintergrund füllen | OpenCV.js Inpainting (Telea) und zeitlicher Hintergrund aus Nachbarframes; optional LaMa (ONNX) | |
| Spielererkennung/Tracking | Personendetektor (ONNX) + Multi-Object-Tracker (z. B. ByteTrack) | **Nur Modelle mit freier Lizenz (Apache-2.0/MIT)**, keine AGPL-Modelle. Lizenz in `docs/LIZENZEN.md` festhalten |
| Tests | Vitest (Logik), Playwright (End-to-End mit kurzen Testvideos in `tests/fixtures/`) | |
| Qualität | ESLint, Prettier, GitHub Action für Build + Tests + Deployment auf Pages | |

Kannst du eine Bibliothek nicht einsetzen (Lizenz, Browser-Support, Grösse), schlage eine Alternative vor und begründe sie, bevor du wechselst.

**Browser-Ziele:** Chrome und Edge (Desktop) mit vollem Funktionsumfang. Safari auf iPad und Chrome auf Android werden unterstützt; wo Funktionen dort eingeschränkt sind (WebGPU, File System Access, HEVC, Dateigrösse), erkennt die App das per Feature-Detection und zeigt einen kurzen Hinweis statt abzustürzen.

---

## 4. Funktionsumfang (Gesamtbild)

### 4.1 Import & Player
- Video per Drag & Drop oder Dateiauswahl hinzufügen, mehrere Videos pro Projekt (z. B. 1. und 2. Halbzeit).
- Metadaten (Dauer, Auflösung, fps, Codec) anzeigen. Nicht abspielbare Codecs: Angebot, eine Proxy-Datei zu erzeugen.
- Player: Play/Pause, bildweise vor/zurück, Sprünge (±2 s, ±10 s), Zeitlupe (0.25×, 0.5×), schneller (2×, 4×), Freeze-Frame (Standbild für X Sekunden in den Clip einfügen).
- Timeline mit Zoom, Scrubbing und Vorschaubildern.

### 4.2 Tagging
- Tag-Leiste mit fester Streethockey-Liste: Tor, Schuss aufs Tor, Schuss neben/geblockt, Bully gewonnen, Bully verloren, Strafe, Powerplay, Boxplay, Konter, Torhüterparade, Ballverlust, Fehler.
- Eigene Tags anlegen (Name, Farbe, Hotkey, Vorlauf/Nachlauf in Sekunden).
- Jeder Tag hat: Zeitpunkt, Team (eigenes/Gegner), optional Spieler, Notiz.
- Kader pro Team (Nummer, Name, Position) erfassen oder als CSV importieren; Spieler per Nummer-Hotkey zuordnen.
- Ein Tag erzeugt automatisch einen Clip (Zeitpunkt − Vorlauf bis + Nachlauf).
- Filter: nach Tag, Team, Spieler; Treffer als Playlist übernehmen.

### 4.3 Schneiden & Gesamtvideo
- Clips mit In/Out-Punkt (Tasten `I` / `O`) schneiden, trimmen, umbenennen, duplizieren.
- Clip-Bibliothek; Playlist per Drag & Drop anordnen.
- Titelfolien (Text, Dauer) zwischen Clips; einfacher Übergang (harter Schnitt oder kurze Blende).

### 4.4 Zeichnen (Telestration)
- Werkzeuge: Pfeil (gerade, gebogen, gestrichelt für Laufweg/Pass), Linie, Freihand, Kreis/Ellipse am Boden (perspektivisch flach), Zone/Fläche (halbtransparent), Text, Nummer-Marker.
- Farben aus der Bulldozers-Palette plus Weiss, Rot, Blau; Strichstärke; Deckkraft.
- Jede Zeichnung ist an eine Zeitspanne gebunden, mit Ein- und Ausblenden; optional «zeichnet sich» (Pfeil wächst animiert).
- Bedienung mit Maus, Finger und Stift (Pointer Events, Druck optional, Handballen ignorieren bei `pointerType=pen`).

### 4.5 Spieler per Klick (KI)
- Klick auf einen Spieler stellt ihn frei (Maske). Kein Umranden.
- **Hervorheben:** Spotlight (Umgebung abdunkeln), Ring am Boden, Kontur, Lupe.
- **Umplatzieren:** Freigestellten Spieler per Ziehen verschieben; die alte Stelle wird automatisch mit Hintergrund gefüllt; optional gestrichelter Pfeil von alter zu neuer Position.
- **Mitführen (Tracking):** Modus **«Automatisch»** (Standard): Markierung folgt dem Spieler über den Clip, Korrektur per Klick möglich. Modus **«Freeze-Frame»**: Video hält an, Markierung/Verschiebung im Standbild, dann läuft es weiter.
- Umschalter in den Einstellungen und direkt in der Werkzeugleiste. Automatischer Wechsel auf «Freeze-Frame», wenn kein WebGPU vorhanden ist, der Benchmark zu langsam ist oder das Tracking den Spieler verliert (mit Hinweis).

### 4.6 Overlays
- **Logo oben rechts:** Bulldozers-Logo (`public/brand/logo-bulldozers.png`), per Schalter ein-/ausblendbar, auch zeitabhängig (Abschnitte auf einer Overlay-Spur).
- **Scoreboard oben links:** zwei Teams mit je 3-Buchstaben-Kürzel (z. B. `BUL`, `GEG`), Teamfarbe, Spielstand. Ein-/ausblendbar wie das Logo.
- **Spielstand automatisch:** Der Stand zu jedem Zeitpunkt ergibt sich aus den Tor-Tags vor diesem Zeitpunkt im Quellvideo. Manuelle Korrektur (Startstand, Ausnahmen) möglich. Auch im Gesamtvideo zeigt jeder Clip den Stand seines Spielzeitpunkts.

### 4.7 Audio
- Kommentar per Mikrofon direkt im Tool aufnehmen, während der Clip läuft (Aufnahme startet an der Abspielposition).
- Mehrere Tonspuren: Originalton + beliebig viele Kommentarspuren; pro Spur Lautstärke, Stumm, Verschieben, Neu aufnehmen.
- Originalton regelbar (Lautstärke, stumm, automatisch leiser während Kommentar).

### 4.8 Taktiktafel
- Streethockey-Feldskizze (Masse konfigurierbar; Standard nach den Spielfeldregeln des internationalen Streethockey-Verbands, Werte in Etappe 9 prüfen und dokumentieren).
- **Ein-/ausblendbar** über dem Video: als Bild-im-Bild (Ecke wählbar), geteilte Ansicht oder Vollbild; im Export enthalten, wenn eingeblendet.
- **Spielsituation übertragen:** Im Standbild wird das Feld einmal über 4 Referenzpunkte kalibriert; die Positionen der Spieler (aus der KI-Erkennung oder per Klick) werden als Marker in Teamfarbe auf die Tafel übertragen.
- Auf der Tafel: Marker verschieben, Pfeile/Laufwege zeichnen, Situation speichern.

### 4.9 Export & Präsentation
- **MP4 1080p** (H.264 + AAC; Quell-fps bis 60 behalten; 4K wird auf 1080p skaliert): Einzelclip und Gesamtvideo aus der Playlist. Mit Fortschritt und Abbrechen; grosse Exporte direkt auf die Festplatte streamen (File System Access), sonst als Download.
- **PNG** des aktuellen Bilds inkl. aller Overlays.
- **Projektdatei `.bdva`** exportieren/importieren. Beim Öffnen fordert die App fehlende Quellvideos an und erkennt sie über Dateiname, Grösse und einen Teil-Hash.
- **Präsentationsmodus** (Vollbild für Beamer): Playlist abspielen, mit Tastatur/Presenter navigieren, live auf dem Video zeichnen (wird nicht gespeichert).

### 4.10 Zwischenspeichern
- Autosave in IndexedDB bei jeder Änderung (entprellt, max. 2 s Verzug) und beim Verlassen der Seite.
- Projektliste auf der Startseite: Projekte öffnen, umbenennen, duplizieren, löschen.
- Nach einem Absturz: «Letzten Stand wiederherstellen». Mikrofonaufnahmen werden sofort beim Stoppen gesichert.
- Hinweis auf den Speicherplatz (`navigator.storage.estimate`) und Bitte um dauerhafte Speicherung (`navigator.storage.persist`).

---

## 5. Datenmodell (Startpunkt)

```ts
Projekt {
  id, name, erstelltAm, geaendertAm, version
  quellen: Quelle[]            // id, dateiname, groesse, teilHash, dauer, fps, breite, hoehe, codec
  teams: [Team, Team]          // kuerzel (3 Buchstaben), name, farbe, kader: Spieler[]
  tagDefinitionen: TagDef[]    // id, name, farbe, hotkey, vorlauf, nachlauf, istTor
  tags: Tag[]                  // id, defId, quelleId, zeit, teamId, spielerId?, notiz?
  clips: Clip[]                // id, quelleId, in, out, name, freezeFrames: {zeit, dauer}[]
  playlist: PlaylistEintrag[]  // {typ:'clip', clipId} | {typ:'titel', text, dauer}
  zeichnungen: Zeichnung[]     // id, quelleId, start, ende, werkzeug, punkte, stil, animation
  spielerObjekte: SpielerObjekt[] // id, quelleId, start, ende, effekt, maskenKeyframes, versatz?, trackingModus
  overlays: { logo: Abschnitt[], scoreboard: Abschnitt[], scoreKorrekturen: {zeit, stand}[] }
  audioSpuren: AudioSpur[]     // id, typ:'original'|'kommentar', lautstaerke, stumm, segmente: {blobId, start, dauer}[]
  taktik: { feld: FeldMasse, kalibrierungen: Kalibrierung[], situationen: Situation[], anzeige: Abschnitt[] }
  einstellungen: { trackingModus: 'auto'|'freeze', exportAufloesung, ... }
}
```

Alle Zeitangaben in Sekunden der jeweiligen Quelle (Gleitkomma), beim Rendern auf Frames gerundet. Das Schema hat eine `version` und Migrationen.

---

## 6. Design (Bulldozers Design System)

Quelle: «Bulldozers Design System» des Vereins. Werte hier übernommen, als CSS-Variablen in `src/styles/tokens.css` anlegen. **Standard ist das dunkle Theme**, für Videoarbeit ideal. Ein helles Theme ist nicht nötig.

**Farben**
| Token | Wert | Einsatz im Tool |
|---|---|---|
| `--bd-gold` | `#BA990E` | Akzente, aktive Werkzeuge, Playhead, Kennzahlen, Fokusrahmen |
| `--bd-green` | `#007057` | Primärbuttons (weisse Schrift), aktive Tags, Erfolgsmeldungen; nicht als kleine Schrift auf Schwarz |
| `--bd-black` | `#000000` | Videobühne, Vollbild |
| `--bd-surface` | `#141414` | App-Hintergrund |
| `--bd-surface-raised` | `#262626` | Panels, Timeline, Dialoge |
| `--bd-ink` | `#ffffff` | Titel, wichtige Texte |
| `--bd-ink-muted` | `#dcdcdc` | Fliesstext |
| `--bd-ink-subtle` | `#bdbdbd` | Hinweise, Zeitangaben |
| `--bd-rule` | `#4a4a4a` | 1px-Trennlinien |
| `--bd-scrim` | `rgba(20,20,20,0.85)` | Abdunklung (auch für Spotlight) |

**Typografie:** ausschliesslich Arial. `"Arial Black", Arial, sans-serif` für Titel, Scoreboard-Ziffern und Kennzahlen; `Arial, Helvetica, sans-serif` für alles andere. Kicker/Labels: 13–14px, fett, Grossbuchstaben, Sperrung 0.18–0.24em, Gold. Fliesstext 13.5–16px.

**Form:** eckig (`border-radius: 0`). Ausnahme: kurze Badges/Chips (`999px`). Struktur über feine Linien, Typografie und Abstand (4/8/12/24px), nicht über Karten-Raster, Icon-Reihen oder Emojis.

**Markenzeichen:** gold-grüner Doppelstreifen (je 30px breit, `skewX(-8deg)`, Gold innen, Grün aussen) dezent im App-Header bzw. auf der Startseite und auf Titelfolien – nicht auf der Arbeitsfläche.

**Video-Overlays im Export:** Scoreboard schwarz/`--bd-surface` mit Teamfarben-Streifen, Kürzel in Arial Black weiss, Spielstand in Gold. Logo nie verzerren oder einfärben; Abstand zum Rand 2.5 % der Bildbreite.

**Bedienbarkeit:** Touch-Ziele mind. 44 × 44 px, alle Funktionen auch per Tastatur, sichtbarer Fokus, Kontrast WCAG AA. Hotkeys in einer Übersicht (`?`).

**Logo-Dateien:** Hauptlogo (Bulldozer im Oval, freigestellt) und Zweitlogo (Kopf mit Helm) werden vom Verein als PNG mit transparentem Hintergrund in `public/brand/` abgelegt. Fehlen sie, Platzhalter verwenden und in `docs/STATUS.md` vermerken.

---

## 7. Qualitätsanforderungen

- **Leistung:** 90-Min.-Datei in 1080p ist nach dem Import in < 5 s abspielbar. Scrubbing ohne Ruckeln. UI bleibt bei 60 fps; schwere Arbeit (Decodieren, KI, Export) läuft in Web Workern.
- **Speicher:** Kein vollständiges Einlesen von Videodateien. Frames nach Gebrauch freigeben (`VideoFrame.close()`).
- **Robustheit:** Fehlermeldungen auf Deutsch, verständlich, mit nächstem Schritt. Kein Datenverlust bei Absturz.
- **Datenschutz:** Videos zeigen Minderjährige. Nichts verlässt das Gerät. Keine externen Skripte ausser KI-Modelldownloads (Quelle und Lizenz dokumentiert).
- **Tests:** Jede Etappe bringt Unit-Tests für die Logik und mindestens einen Playwright-Test für den Hauptablauf.

---

## 8. Arbeitsweise für Claude Code

1. **Eine Etappe nach der anderen.** Vor dem Programmieren: kurzen Plan in `docs/plan/etappe-XX.md` schreiben (Dateien, Ansatz, Risiken) und mir zeigen, wenn eine Grundsatzfrage offen ist.
2. Pro Etappe ein eigener Branch `etappe-XX-name`, kleine Commits mit klaren Nachrichten auf Deutsch.
3. Am Ende jeder Etappe: Build und Tests grün, `docs/STATUS.md` aktualisiert (erledigt, offen, bekannte Grenzen), kurze Testanleitung für mich als Nutzer (was klicken, was soll passieren).
4. Nichts aus späteren Etappen vorwegnehmen, aber die Architektur so anlegen, dass es später passt (Render-Pipeline, Datenmodell, Overlay-Spuren).
5. Bei Unklarheiten zur Fachlichkeit (Streethockey, Coaching) fragen statt raten.
6. Keine Funktionen ergänzen, die hier nicht beschrieben sind, ohne sie vorzuschlagen.
