# STATUS

Stand: Ende Etappe 0 «Fundament».

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
