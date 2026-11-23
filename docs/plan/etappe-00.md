# Plan Etappe 0 – Fundament

Stand: Planung vor Umsetzung. Entscheide mit dem Auftraggeber abgestimmt:

- Alle Etappen laufen auf dem Sitzungs-Branch `claude/magical-cerf-nxizu6`; Etappenabschluss = eigener Commit + Tag `etappe-00-fertig`.
- GitHub Pages: `base = /Videoanalysetool/` (Repo-Name), Pages-Quelle «GitHub Actions» stellt der Auftraggeber ein.
- Logos fehlen → Platzhalter, Vermerk in `docs/STATUS.md`.
- Grossdatei-Abnahme (90 Min.) macht der Auftraggeber lokal; hier laufen Tests mit Kurzvideos (ffmpeg erzeugt Fixtures).

## Ansatz

**Stack:** Vite + React + TypeScript strict, Zustand + Immer, Dexie, Mediabunny, CSS Modules, Vitest, Playwright, ESLint, Prettier.

**Wiedergabe grosser Dateien:** `<video>` mit `URL.createObjectURL(File)` – der Browser streamt, nichts wird in den RAM geladen. Mediabunny liest nur Metadaten (Header/Index) und liefert später bildgenaue Frames. Bildweises Springen: `currentTime = round(t*fps)/fps + epsilon`.

**Vorschaubilder der Timeline:** Worker mit Mediabunny (`CanvasSink`), seltene Stichproben (z. B. alle N Sekunden, abhängig von Dauer, max. ~200 Bilder), als JPEG-Blob in IndexedDB (Tabelle `thumbs`) gecacht, lazy und abbrechbar. Bei Fehler: leere Timeline ohne Bilder, kein Absturz.

**Datei-Wiederverknüpfung:** `FileSystemFileHandle` in IndexedDB (Tabelle `handles`) speichern, wo `showOpenFilePicker` existiert; beim Öffnen `queryPermission/requestPermission`. Sonst Dateidialog; Zuordnung über Name + Grösse + Teil-Hash (SHA-256 über erste und letzte 1 MB).

**Autosave:** Store-Änderung → entprellter Schreibvorgang (≤ 2 s, `maxWait`), `pagehide`/`visibilitychange` flush. Projekt als ein Dokument in Dexie `projekte`; zusätzlich Tabelle `wiederherstellung` (Schattenkopie) für «Letzten Stand wiederherstellen» nach unsauberem Beenden (Flag `sauberBeendet` in localStorage/Meta).

**Undo/Redo:** Command-History mit Immer-Patches (`produceWithPatches`); Befehl = Patches + inverse Patches. Ctrl+Z / Ctrl+Y (auch Ctrl+Shift+Z).

**Render-Gerüst:** `src/render/renderFrame.ts` – reine Funktion `renderFrame(t, projekt, ziel)`, `ziel = {ctx, breite, hoehe, modus:'vorschau'|'export'}`; zeichnet vorerst nichts. `OverlayCanvas` ruft sie pro `requestVideoFrameCallback` auf.

**Feature-Detection:** `src/platform/features.ts` (WebCodecs, WebGPU, File System Access, `showSaveFilePicker`, Codec-Support per `VideoDecoder.isConfigSupported`/`video.canPlayType`). Hinweisdialog beim ersten Start und bei Problemen.

**Proxy (ffmpeg.wasm):** Dynamischer Import erst auf Nutzerwunsch; Single-Thread-Core (`@ffmpeg/core`, kein COOP/COEP nötig auf GitHub Pages). Ergebnis: 1080p H.264 + AAC, in IndexedDB/OPFS abgelegt, als Quelle `proxyFuer` verknüpft. Core-Dateien werden mit der App ausgeliefert (kein CDN → Datenschutz-Grundsatz); Dateigrösse ~30 MB, nur bei Bedarf geladen.

**Layout:** Header (Doppelstreifen dezent) · Bühne · rechte Seitenleiste (leer, Platzhalter-Panels) · Timeline unten; Breakpoints Laptop/Tablet. Design-Tokens aus CLAUDE.md Abschnitt 6. Alle Texte in `src/i18n/de-CH.ts`.

## Dateien (Auswahl)

```
src/main.tsx, App.tsx, router (Hash-Routing, passt zu GitHub Pages)
src/styles/tokens.css, global.css
src/i18n/de-CH.ts
src/model/typen.ts, schema.ts (version, migrationen), standard.ts
src/store/projektStore.ts, history.ts, autosave.ts
src/db/db.ts (Dexie), handles.ts, speicher.ts
src/video/quelle.ts (Metadaten, Hash), player.ts (Frame-Mathe), thumbs.worker.ts
src/render/renderFrame.ts, OverlayCanvas.tsx
src/platform/features.ts
src/proxy/ffmpegProxy.ts
src/ui/ Startseite, Projektliste, Editor, Player, Timeline, Seitenleiste, Dialoge
tests/ (Vitest-Unit), e2e/ (Playwright), tests/fixtures/ (ffmpeg-erzeugt)
.github/workflows/deploy.yml
```

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Headless Chromium kann H.264 nicht abspielen | Fixtures in VP9/WebM **und** H.264/MP4; E2E-Test nutzt, was die Testbrowser-Binary kann; H.264-Pfad zusätzlich manuell |
| Mediabunny-API-Details | Version fixieren, Kapselung in `src/video/` |
| Vorschaubilder bei 90 Min./HEVC langsam | Wenige Stichproben, Worker, abbrechbar, Cache |
| ffmpeg.wasm Grösse | nur lazy, nicht im Hauptbundle |
| Handles nur in Chromium | Fallback Dateidialog + Hash-Erkennung |
| Abnahme 90-Min.-Datei hier nicht prüfbar | Testanleitung für lokalen Test |

## Reihenfolge

1. Gerüst, Tooling, CI → 2. Tokens/Layout/i18n → 3. Modell + Store + Undo → 4. DB/Autosave/Startseite → 5. Import/Metadaten/Handles → 6. Player + Timeline + Thumbs → 7. renderFrame-Gerüst → 8. Feature-Detection + Proxy → 9. Tests, STATUS, Testanleitung.
