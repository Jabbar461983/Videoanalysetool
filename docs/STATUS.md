# STATUS

Stand: Ende Etappe 5 «Audio & Vertonung» (Etappen 0–4 siehe unten, weiterhin gültig).

## Layout-Verbesserung (nach Etappe 5)

- Bedienelemente sind mit Maus kompakter (36 px), mit Touch/Stift weiter 44 px hoch (`@media (pointer: fine)`).
- Quell-Zeitleiste niedriger (Vorschaubilder 64 px); Video-, Tag- und Clip-Spur sind vollständig sichtbar. Tag-Leiste kompakter, Kopfzeile schmaler → grössere Videobühne (bei 1900×950 etwa +40 %).
- **Höhe der Zeitleiste verstellbar:** Griff am oberen Rand der Zeitleiste (Ziehen, Pfeil hoch/runter, Doppelklick = automatisch); wird gemerkt.
- Clip-Zeitleiste: Overlay-Spur nur, wenn Abschnitte existieren; schmalere Videospur. Aufnahme-Tipp nur vor dem Aktivieren des Mikrofons.
- Auf 720p-Bildschirmen bleibt die Bühne im Clip-Editor mit etwa 250 px Höhe klein (Werkzeug- und Aufnahmeleiste); Zeitleiste dort bei Bedarf kleiner ziehen.

## Erledigt (Etappe 5)

- **Tonspuren pro Clip:** Originalton + beliebig viele Kommentarspuren, je Spur Lautstärke, Stumm, Solo. Im Clip-Editor (Abschnitt «Ton») und als Spuren mit **Wellenform** in der Clip-Zeitleiste (Original: Spitzen aus der Quelldatei nur für den Clipbereich; Kommentare: gespeicherte Spitzen).
- **Mikrofonaufnahme:** Mikrofon wählen, Pegelanzeige, Countdown 3-2-1 (Bild steht), Aufnahme startet an der Abspielposition und läuft mit dem Video mit (`getUserMedia` + `MediaRecorder`). Stopp, Pause oder Ende der Wiedergabe beenden die Aufnahme; sie wird **sofort in IndexedDB** gesichert (inkl. Wellenform). Aufnahmen werden in Stücken à 250 ms gesammelt.
- **Segmente:** verschieben und kürzen (Ziehen in der Zeitleiste oder Zahlenfelder, nie über die Aufnahme hinaus), löschen (Rückgängig geht), **neu aufnehmen** (ersetzt ab Segmentstart, gleiche Spur). Überlappt eine neue Aufnahme ein bestehendes Stück, entsteht automatisch eine weitere Spur.
- **Ducking:** Originalton sinkt während hörbarer Kommentare (Standard −12 dB, 0.15 s ab / 0.25 s auf), pro Clip einstellbar oder abschaltbar.
- **Standbilder:** Das Video steht, der Originalton ist dort stumm, Kommentare laufen weiter.
- **Vorschau über Web Audio:** beide Video-Elemente laufen über einen gemeinsamen Gain (Original: Lautstärke/Stumm/Solo/Ducking als Kurve), Kommentare als zeitgenau geplante Puffer; Neusynchronisation bei Abweichung > 120 ms. Gilt für Clip-Editor und Playlist.
- **Mixdown:** `mixdownRender()` (`OfflineAudioContext`) nutzt dieselbe Planung (`audioPlan`) wie die Vorschau; der Export in Etappe 6 reicht zusätzlich die Original-Puffer der Quelle herein (Schnittstelle `original`).
- Zeitabgleich: Der Start eines Kommentars folgt dem Videobild beim Einfügen/Entfernen von Standbild/Zeitlupe und beim Trimmen (wie bei Zeichnungen).
- Aufräumen: Aufnahmen, die in keinem Projekt mehr vorkommen, werden beim Öffnen der Startseite entfernt.
- Zeitleiste in Reihen umgebaut (statt fester Pixelpositionen); sie scrollt bei vielen Spuren senkrecht.
- Schema-Version 6 (`audioSpuren` am Projekt entfällt). Tests: 92 Unit-Tests (Hörplan inkl. Ducking/Solo/Playlist, Segment-Operationen, Zeitabgleich, Wellenform, Migration), 9 E2E-Tests (neu: Kommentar aufnehmen mit Fake-Mikrofon über ein Standbild hinweg, Ducking-Kurve, Stumm/Solo, Kürzen/Verschieben/Löschen/Rückgängig, Neu aufnehmen, Mixdown mit Pegelprüfung, Neuladen).

## Etappe 5: Entscheide und Grenzen

- **Nur in Clip- und Playlist-Wiedergabe** wirken Kommentare/Ducking; in der reinen Quell-Ansicht läuft der Originalton unverändert.
- **Echo:** Spielt der Videoton über Lautsprecher, nimmt das Mikrofon ihn mit auf. Der Hinweis «Kopfhörer tragen» steht im Aufnahme-Bereich; Echo-/Rauschunterdrückung ist angefordert, aber geräteabhängig.
- Die Latenz zwischen Aufnahmestart und Video (typisch 30–100 ms) wird nicht kompensiert.
- Automatisch geprüft ist die Aufnahme mit einem **simulierten Mikrofon** und das Zeitverhalten der Planung. **Tatsächlicher Klang, Lippensynchronität und Ducking-Höreindruck sind nicht gehört** – bitte mit echtem Mikrofon und Kopfhörern prüfen (Chrome/Edge, Safari/iPad: Aufnahmeformat MP4/AAC statt WebM).
- Original-Wellenform braucht die verknüpfte Videodatei und einen Audio-Codec, den der Browser dekodiert (AAC/Opus); sonst bleibt die Spur leer.
- Lautstärke-Schieber starten die laufende Kommentar-Wiedergabe neu (kurzes Absetzen), statt live nachzuregeln.
- Ein Hilfsschalter für Tests: `localStorage['bdva-test']='1'` lädt `window.__bdvaTest` (Mixdown/Hörplan abfragen); im Normalbetrieb inaktiv.
- Nach dem Neuladen muss die Videodatei wieder verknüpft werden (wie bisher); ohne Datei startet der Programmspieler nicht und zeigt eine Meldung statt zu hängen (neu behoben).

## Erledigt (Etappe 4)

- **Logo oben rechts** aus `public/brand/logo-bulldozers.png`; fehlt die Datei, wird `logo-platzhalter.svg` verwendet (Hinweis im Setup). Breite in % der Bildbreite (Standard 10 %, Regler im Reiter «Setup»), Abstand 2.5 % der Bildbreite, Seitenverhältnis bleibt, keine Einfärbung.
- **Scoreboard oben links:** `[Teamfarbe] KÜR 2 : 1 KÜR [Teamfarbe]`, Kürzel Arial Black weiss, Stand Gold, Hintergrund `#141414` leicht transparent.
- **Spielstand automatisch** aus den Tor-Tags (Startstand + Tore je Team bis einschliesslich Zeitpunkt; Tore früherer Quellen/Halbzeiten zählen mit). Manuelle Korrekturen («ab hier gilt a : b», spätere Tore zählen weiter) und Startstand im Reiter «Setup». Hinweis, wenn Tore keinem Team zugeordnet sind.
- **Schalter:** global per Hotkey `L` (Logo) und `S` (Spielstand) sowie Knöpfe im Player; zeitabhängig über **Ausblend-Abschnitte pro Clip** (Overlay-Spur in der Clip-Zeitleiste, ziehbar; Knöpfe «… ausblenden ab Position» im Clip-Editor). Titelfolien: Schalter «Logo auf der Titelfolie»; der Spielstand erscheint dort nie.
- Im Clip und im Gesamtvideo zeigt das Scoreboard den Stand der **Quellzeit des gezeigten Bildes** (auch im Standbild und in der Zeitlupe); in der Quell-Ansicht den Stand der Abspielposition.
- Alles in `renderFrame()`; Reihenfolge Titel/Zeichnungen → Logo/Scoreboard → Blende. Das Logo-Bild reicht der Aufrufer über `ziel.logo` herein (Export in Etappe 6 mit Bitmap im Worker).
- Ausblend-Abschnitte folgen dem Clip bei Standbild/Zeitlupe/Trimmen (Zeitabgleich wie bei Zeichnungen).
- Schema-Version 5. Tests: 77 Unit-Tests (Spielstand: Halbzeiten, Korrekturen, Gleichzeitigkeit; Ausblenden; Migration), 8 E2E-Tests (neu: Stand ändert sich nach Tor-Tags und folgt dem Clip, L/S-Hotkeys, Abschnitte, Titelfolie, Korrektur).

## Etappe 4: Entscheide und Grenzen

- **«Zeitabhängig» = Ausblend-Abschnitte** (Standard: immer sichtbar). **Bitte bestätigen**, sonst baue ich es als «nur in diesen Abschnitten sichtbar» um.
- Das echte Vereinslogo fehlt noch (`public/brand/logo-bulldozers.png`); es läuft das Platzhalter-Logo.
- In der Quell-Ansicht gelten nur die globalen Schalter, nicht die Clip-Abschnitte.
- Tore ohne Teamzuordnung zählen nicht (Team im Reiter «Tags» setzen). Im Export-Hinweis später relevant.
- Die Schrift «Arial Black» muss auf dem Gerät vorhanden sein (Windows/macOS: ja); sonst wird Arial fett verwendet.
- Layout: Im Clip-Editor ist die Tag-Leiste ausgeblendet, damit das Video auf 720p-Bildschirmen Platz hat; auf kleinen Laptops bleibt die Videobühne dennoch klein (Werkzeugleiste und Zeitleiste belegen Platz).

## Erledigt (Etappe 3)

- **Werkzeuge** (im Clip-Editor): Pfeil (gerade oder gebogen, durchgezogen/gestrichelt, Spitze am Ende/beidseitig/keine), Linie, Freihand (vereinfacht und geglättet, optional Stiftdruck), Kreis/Ellipse am Boden (Mittelpunkt + zwei Achsenpunkte → flach und verzerrbar), Zone (Polygon, halbtransparent; schliessen per Klick auf die erste Ecke, Doppelklick, Enter oder Knopf), Text (mit Hintergrundbox), Nummer-Marker (zählt hoch, Nummer änderbar).
- **Stil:** Gold, Grün, Weiss, Rot, Blau, Schwarz; Strichstärke; Deckkraft; gestrichelt; Pfeilspitzen. Im Auswahl-Modus wirkt die Leiste auf die ausgewählte Zeichnung, sonst auf die nächste.
- **Zeit:** Jede Zeichnung gehört zu einem Clip, Start/Ende in Clip-Zeit. Standard ab jetzt bis Ende des Standbilds, sonst 3 s. Eigene Overlay-Spur in der Clip-Zeitleiste: Balken ziehen verschiebt, Ränder ziehen ändert die Zeitspanne; Zahlenfelder im Panel.
- **Animation:** sofort, einblenden, «zeichnet sich» (Linienwerkzeuge), dazu Ausblenden am Ende; Dauer einstellbar.
- **Bearbeiten:** auswählen (Klick, Liste, Balken), verschieben, Punkte ziehen, kopieren/einfügen (Strg+C/V), löschen (Entf), Ebenen (nach vorn/hinten/eine Ebene), Undo/Redo, Pfeil gerade ↔ gebogen.
- **Eingabe:** Pointer Events für Maus, Finger, Stift. Stift hat Vorrang: Berührungen bis 1.5 s nach Stiftkontakt/-schweben (Handballen) und zusätzliche Finger werden ignoriert. Optionale Druckstärke bei Freihand.
- **«Beim Zeichnen anhalten»** (Projekteinstellung, Standard an) hält die Wiedergabe beim ersten Kontakt an.
- **Rendering:** ausschliesslich in `renderFrame()` (`src/render/zeichnungen.ts`), normierte Koordinaten, Grössen skalieren mit der Bildbreite. Auch die Live-Vorschau beim Zeichnen/Verschieben läuft über `renderFrame()`. Playlists zeigen die Zeichnungen ihrer Clips.
- **Zeitabgleich:** Standbild/Zeitlupe einfügen oder entfernen und Trimmen verschiebt Start/Ende der Zeichnungen so, dass sie am gleichen Videobild bleiben.
- **Favoriten:** Zeichnung als Favorit speichern (Vorlagen in IndexedDB) und an der aktuellen Zeit wieder einfügen.
- Clip löschen entfernt seine Zeichnungen, Clip duplizieren kopiert sie.
- Schema-Version 4. Tests: 68 Unit-Tests, 6 E2E-Tests (neu: Stift-Pfeil mit Animation und Zeitfenster samt Handballen-Test; Marker/Text/Zone/Verschieben/Kopieren/Favorit/Playlist).

## Etappe 3: Entscheide und Grenzen

- **Standard-Animation ist «sofort»** (nicht «zeichnet sich»), damit eine frisch gezeichnete Linie im angehaltenen Bild sichtbar bleibt. Die Animation wählst du in der Leiste (oder im Panel pro Zeichnung).
- Gezeichnet wird nur im Clip-Editor; in der reinen Quell-Ansicht erscheinen keine Zeichnungen.
- Die Stift-/Touch-Logik ist getestet (Unit-Test, synthetische Zeigerereignisse), aber **nicht mit echtem Stift auf einem Convertible**. Bitte dort prüfen, v. a. Handballen und Druckstärke.
- Die Auswahl-Hilfsrahmen und Griffe sind Bedienelemente und nicht im Export enthalten (sollen sie auch nicht).
- Bei mehr als vier sich zeitlich überlappenden Zeichnungen teilen sich die letzten die unterste Bahn der Overlay-Spur (sie sind in der Liste weiter einzeln wählbar).
- Perspektivische Verzerrung ist auf Ellipsen (affin: Achsen frei ziehbar) begrenzt; keine echte Perspektiv-Homographie (kommt mit der Kalibrierung in Etappe 9).
- Text hat eine feste Schriftgrösse aus der Stärke (20 + 3 × Stärke) und bricht nicht um.

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
