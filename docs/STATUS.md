# STATUS

Stand: Ende Etappe 2 «Schneiden, Clips & Gesamtvideo» (Etappen 0 und 1 siehe unten, weiterhin gültig).

## Erledigt (Etappe 2)

- **Manuelle Clips:** `I` In, `O` Out, `Enter` speichert (Marken auf der Timeline, Panel «Neuer Clip»), `Esc` verwirft. Clip-Spur in der Timeline; der ausgewählte Clip hat Ziehgriffe an Anfang und Ende. Bildgenau per Tastatur: Bild anfahren, dann `Shift+I` / `Shift+O` setzt In/Out des ausgewählten Clips; im Clip-Editor zusätzlich ±1-Bild-Knöpfe.
- **Clip-Bibliothek:** Vorschaubild (Worker, gecacht), Name (umbenennen), Dauer inkl. Standbildern/Zeitlupe, zugehöriger Tag/Team/Spieler, Duplizieren, Löschen (entfernt den Clip auch aus allen Playlists), «In Playlist».
- **Clip-Editor** (Reiter «Clips» → «Bearbeiten»): eigene Zeitleiste nur für diesen Clip mit Video-, Standbild- und Zeitlupen-Abschnitten.
- **Standbild (Freeze-Frame):** an der aktuellen Position für wählbare Dauer (Standard 3 s), Teil der Clip-Zeitachse; Originalton pausiert (Video steht).
- **Zeitlupe** als Abschnitt (0.25× oder 0.5×); Abschnitte dürfen sich nicht überlappen.
- **Playlists:** mehrere pro Projekt, Einträge per Drag & Drop oder ↑↓ ordnen, Clips und Titelfolien mischen, Duplizieren/Umbenennen/Löschen.
- **Titelfolien:** Kicker, Titel, Untertitel, Dauer; Bulldozers-Stil (dunkler Grund, Doppelstreifen, Gold-Kicker, Arial Black), gezeichnet von `renderFrame()`. Vorschau im Player.
- **Übergang je Eintrag:** harter Schnitt oder Blende (0.3 s).
- **Playlist-Vorschau:** nahtlos über zwei Video-Elemente (Doppelpuffer, nächstes Segment wird vorbereitet), Standbilder und Titel auf virtueller Uhr.
- **Zeitachse:** `src/wiedergabe/zeitachse.ts` mit `clipZeitZuQuellZeit`, `clipSegmente`, `playlistZeitplan`, `blendeAlpha` – rein und getestet; der Export in Etappe 6 nutzt dieselben Funktionen.
- Schema-Version 3 (Playlisten, Zeitlupen), Migration übernimmt die Playlist aus Etappe 1.
- Tests: 49 Unit-Tests, 4 E2E-Tests (neu: Schneiden → Trimmen per Taste und Ziehen → Standbild/Zeitlupe → Playlist mit Titelfolie und Blende abspielen → Neuladen).

## Etappe 2: Entscheide und Grenzen

- **Blende = Ab-/Aufblende über Schwarz** (je 0.15 s am Ende des vorherigen / Anfang des nächsten Eintrags), keine echte Überblendung. Die Gesamtdauer bleibt die Summe der Einträge. **Bitte bestätigen**, sonst baue ich später einen Crossfade.
- Playlist-Einträge und Titelfolien: Datenmodell weicht vom Startpunkt in CLAUDE.md ab (`playlisten[]`, Titel mit Kicker/Titel/Untertitel); CLAUDE.md Abschnitt 5 ist dort nur «Startpunkt».
- In Clip- und Playlist-Wiedergabe sind Tagging-Tasten und `I`/`O` bewusst aus; Tempo-Auswahl gilt nur für die Quelle.
- Beim Clipwechsel auf eine andere Quelle wird die Quelle auf dem versteckten Element vorgeladen; Ruckelfreiheit wurde hier nur automatisch auf Durchlauf geprüft, nicht gemessen. Bitte mit einer echten Playlist (10 Clips) prüfen.
- Standbild und Zeitlupe verschieben sich nicht mit, wenn der Clip nach dem Setzen getrimmt wird; Elemente ausserhalb werden entfernt/gekürzt.
- Originalton in Zeitlupe läuft mit Browser-Tonhöhenkorrektur; Ton im Export folgt in Etappe 5/6.
- Titelfolien-Schrift: «Arial Black» wird vom System gestellt; auf Geräten ohne diese Schrift fällt die Darstellung auf Arial zurück.
- Kleine Lücke: Springen aus Tag-/Clip-Liste in eine andere Quelle schaltet nun die Quelle um, die Position wird dort erst nach dem Laden zuverlässig gesetzt.

## Erledigt (Etappe 1)

- Teams: Kürzel (3 Grossbuchstaben, validiert), Name, Farbe; Vorlagen für Team, Kader und Tag-Set in IndexedDB, je Typ eine als «Standard für neue Projekte» markierbar (so entsteht z. B. «BUL – SHC Bulldozers» automatisch in neuen Projekten).
- Kader: von Hand erfassen (Nummer, Name, Position) oder per CSV (`Nummer;Name;Position`, `;` oder `,`, Kopfzeile/BOM/Anführungszeichen ok; fehlerhafte Zeilen werden gezählt und übersprungen).
- Tag-Leiste mit den 12 festen Streethockey-Tags (Farbe, Hotkey, Vor-/Nachlauf 8 s/4 s, «Tor» zählt als Tor). Eigene Tags: anlegen, bearbeiten, sortieren (↑↓), ausblenden; feste Tags nur ausblenden. Hotkey-Prüfung (doppelt/reserviert).
- Taggen live: Hotkey oder Klick setzt ein Tag an der Abspielposition, Wiedergabe läuft weiter. Danach `1`/`2` = Team, Nummer + `Enter` = Spieler, `Tab` = Team wechseln, `Esc` = fertig (Fenster schliesst nach 8 s Inaktivität). Notiz und Korrekturen im Tab «Tags».
- Tag-Spur in der Timeline: farbige Marken, Klick springt dorthin.
- Auto-Clip pro Tag (Zeit − Vorlauf … Zeit + Nachlauf, begrenzt), Clip-Liste (Tab «Clips»); Tag löschen löscht den Clip.
- Filter nach Tag, Team, Spieler und Kombination; «Treffer in Playlist übernehmen» (chronologisch, ohne Dubletten) füllt `projekt.playlist`. Oberfläche dafür kommt in Etappe 2.
- Hotkey-Übersicht (`?`) zeigt nun auch die Tag-Tasten.
- Schema-Version 2 mit Migration (alte Projekte erhalten die Standard-Tags).
- Tests: 29 Unit-Tests, 3 E2E-Tests (Hauptablauf, Projektliste, Live-Taggen inkl. CSV, Filter, Neuladen).

## Etappe 1: Entscheide und Grenzen

- Hotkeys sind meine Vorschläge (G Tor, A Schuss aufs Tor, N Schuss daneben/geblockt, B/V Bully gewonnen/verloren, P Strafe, W Powerplay, X Boxplay, K Konter, H Torhüterparade, U Ballverlust, F Fehler) – frei änderbar. Reserviert für spätere Etappen: I, O, L, S, T, C.
- Team-Wahl `1`/`2` und Spielernummer teilen sich die Ziffern: `1`/`2` gelten nur als Team, solange noch kein Team gewählt und noch keine Ziffer getippt ist. Danach sind Ziffern Nummern (Spieler 1 und 2 sind also erreichbar).
- Ohne Teamwahl sucht `Enter` die Nummer in beiden Kadern (erste Übereinstimmung).
- Zwei Tags mit gleichem Hotkey sind möglich, aber mit Warnung; es gilt der erste.
- Marken, die auf der Timeline sehr nah beieinander liegen, überdecken sich (in der Liste rechts bleiben alle erreichbar).
- Sprung aus Tag-/Clip-Liste in eine *andere* Quelle schaltet die Quelle um, springt aber erst nach dem Laden zuverlässig; offen für Etappe 2.
- Vorlagen löschen läuft über eine einfache Namensabfrage (kein Dialog-Design).

## Erledigt (Etappe 0)

- Vite + React 19 + TypeScript (strict), ESLint, Prettier, Vitest (15 Tests), Playwright (E2E), GitHub Action (Lint, Tests, Build, E2E, Deployment auf Pages, `base=/Videoanalysetool/`).
- Design-Tokens (`src/styles/tokens.css`), dunkles Layout: Header mit Doppelstreifen, Videobühne, rechte Seitenleiste, Timeline unten; responsiv (Laptop, Tablet, schmal).
- Alle Texte in `src/i18n/de-CH.ts`.
- Datenmodell nach CLAUDE.md Abschnitt 5 mit `version` und Migrationsgerüst; Zustand-Store mit Command-History (Immer-Patches), Undo/Redo per Strg+Z / Strg+Y (Strg+Shift+Z).
- Autosave (Dexie/IndexedDB): entprellt 1 s, spätestens 2 s, zusätzlich bei `pagehide`/`visibilitychange`; Schattenkopie und Hinweis «Letzten Stand wiederherstellen» nach unsauberem Beenden; `navigator.storage.persist()` und Speicheranzeige.
- Startseite: Projekte neu, öffnen, umbenennen, duplizieren, löschen.
- Video-Import (Drag & Drop, Dateiauswahl, mehrere Quellen), Metadaten mit Mediabunny, Teil-Hash (erste/letzte 1 MB), File-System-Access-Handles (wo vorhanden), Wiederverknüpfung.
- Player: Leertaste, bildweise ←/→, Shift+Pfeile ±2 s, Strg+Pfeile ±10 s, Tempo 0.25×–4× (`,` `.`), Zeit mit Frames.
- Timeline: Zoom (Buttons, Strg+Mausrad), Scrubbing per Zeigerereignisse, Vorschaubilder im Worker, in IndexedDB gecacht.
- Render-Gerüst: `renderFrame(t, projekt, ziel)` (zeichnet noch nichts), Overlay-Canvas über dem Video.
- Feature-Detection mit Hinweisdialog; Proxy-Erzeugung (1080p H.264) mit ffmpeg.wasm, nur bei Bedarf geladen.
- Hotkey-Übersicht per `?`.

## Gemessen (Cloud-Umgebung, headless Chromium)

- 750-MB-Datei (10 Min., 1080p, H.264): Metadaten nach ~100 ms sichtbar, JS-Heap unverändert (13 MB) – es wird nichts eingelesen. Test: `BDVA_GROSS=<Datei> npm run e2e -- gross`.
- Die echte 90-Min.-Abnahme auf deinem Gerät steht noch aus (siehe Testanleitung).

## Offen / bekannte Grenzen

- **Logos fehlen**: `public/brand/logo-bulldozers.png` und Zweitlogo bitte ablegen. Bis dahin Platzhalter `logo-platzhalter.svg`.
- **GitHub Pages**: in den Repo-Einstellungen «Pages → Source: GitHub Actions» setzen. Deploy läuft aktuell auch von `claude/**`-Branches; ggf. Environment-Regeln für `github-pages` anpassen.
- Headless-Chromium der Testumgebung spielt kein H.264 ab; E2E nutzt VP9/WebM. H.264/MP4-Wiedergabe bitte manuell prüfen.
- Proxy (ffmpeg.wasm): im Browser nicht automatisiert getestet (30 MB Kern); sehr grosse Dateien (> ~2 GB) können am WASM-Arbeitsspeicher scheitern, Hinweis ist im Dialog. Bitte manuell mit einer HEVC-Datei prüfen.
- Bildgenaues Springen nutzt `video.currentTime` (Bildmitte); Mediabunny-Frame-Zugriff folgt dort, wo er gebraucht wird (Export, Etappe 6).
- Wiederherstellung (`wiederherstellung`-Tabelle) wird bei jedem Speichern aktualisiert; sie greift nur, wenn der Hauptspeicher einmal fehlschlägt. Reicht für Etappe 0.
- iPad/Safari: kein File-System-Access → Videos nach Neuladen erneut wählen (werden über Name/Grösse/Hash erkannt, aber noch ohne automatische Zuordnung beim Auswählen eines beliebigen Files – kommt mit der Projektdatei in Etappe 6).
- Branch-Konvention angepasst: alles auf `claude/magical-cerf-nxizu6`, Etappenende per Tag `etappe-00-fertig`.
