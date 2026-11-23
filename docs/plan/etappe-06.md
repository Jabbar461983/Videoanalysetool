# Plan Etappe 6 – Export, Projektdatei & Präsentationsmodus

Weiter auf `claude/magical-cerf-nxizu6`.

## Entscheide

- **Export-Pipeline** (Worker `exportWorker`): Quellbilder decodieren (Mediabunny `CanvasSink`, nur die benötigten Zeitpunkte, sequenziell) → auf `OffscreenCanvas` zeichnen → **`renderFrame()`** (dieselbe Funktion wie die Vorschau: Titelfolien, Zeichnungen, Logo, Scoreboard, Blenden) → `VideoEncoder` (H.264) → MP4-Mux (Mediabunny `Output`/`CanvasSource`). Standbilder wiederholen ein Bild, Zeitlupe nutzt die Zeitachse aus `zeitachse.ts` (`Segment.tempo`), Titelfolien brauchen keine Quelle.
- **Ton auf dem Hauptthread** (Web Audio gibt es im Worker nicht): `mixdownRender()` aus Etappe 5 mit dem Originalton der Quellsegmente (Mediabunny `AudioBufferSink`) → Kanaldaten werden an den Worker übergeben und dort als `AudioSample` (AAC) in den Mux geschrieben, im Wechsel mit den Bildern (kein Speicheraufbau).
- **Codec-Wahl:** H.264 + AAC; kann der Browser AAC nicht kodieren, wird Opus verwendet, ohne H.264 VP9 (im MP4). Die gewählten Codecs und ein Hinweis stehen vor dem Start im Export-Reiter. Ohne Hardware-Encoder: nach wenigen Sekunden Hinweis mit geschätzter Dauer.
- **Einstellungen:** 1080p (Standard) oder 720p; Bildrate der Quelle, höchstens 60; Bitrate automatisch (bit pro Pixel); 4K wird herunterskaliert, kleinere Quellen werden nicht hochskaliert. Ausgabegrösse folgt dem Seitenverhältnis der ersten Quelle; abweichende Quellen werden mit Rand eingepasst.
- **Ziel:** Mit `showSaveFilePicker` wird direkt in die Datei geschrieben (`StreamTarget`, kein Aufbau im Arbeitsspeicher); sonst `BufferTarget` und Download. Abbrechen löscht die angefangene Datei, wenn der Browser das erlaubt.
- **PNG:** aktuelles Bild inkl. aller Overlays über dieselbe `renderFrame()`-Funktion (Auflösung bis 1920 Breite).
- **Projektdatei `.bdva`** (ZIP, fflate): `manifest.json`, `projekt.json` (ohne Proxy-Verweise), `audio/…` mit `audio.json`, `logos/…`; **ohne Quellvideos**. Import legt ein neues Projekt an (bei gleicher Id eine Kopie), migriert das Schema und stellt die Aufnahmen wieder her. Fehlende Quellvideos fordert ein Banner im Editor an; Zuordnung über Dateiname, Grösse und Teil-Hash (mehrere Dateien auf einmal wählbar).
- **Präsentationsmodus:** Vollbild (`requestFullscreen`), nur Bühne; Pfeile/Bild-auf/Bild-ab = vorheriger/nächster Playlist-Eintrag, Leertaste Pause, `Esc` beenden, `C` löscht die Live-Zeichnung; **Live-Stift** (Stift immer, Maus/Finger per Schalter) auf eigener Ebene, wird nicht gespeichert; Steuerleiste blendet sich nach 2.5 s aus.
- Prüfung Vorschau ≙ Export: E2E rendert dasselbe Bild in der Vorschau und im Export (Pixelstichproben).

## Dateien

`src/export/{format,exportWorker,exportieren,originalton,png}.ts` · `src/projektdatei/{bdva,zuordnung}.ts` · UI `ExportPanel`, `QuellenBanner`, `Praesentation`-Teile in `Buehne`/`Editor`/`tasten`, Startseite (Import/Export) · Tests Unit + Playwright.

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Kein H.264/AAC-Encoder im Browser | automatische Ausweichcodecs + Hinweis |
| Sehr lange Exporte / Speicher | Direkt in Datei schreiben; Ton wird in 0.5-s-Stücken übergeben (der Mixdown selbst liegt im Speicher: bei > 30 Min. Hinweis) |
| Schriften im Worker | Systemschriften (Arial / Arial Black) wie im Hauptthread |
| Unterschiede Vorschau/Export | Gemeinsame Funktion `renderFrame`, Pixeltest |
| Fullscreen blockiert | Nur auf Klick; Fehler werden abgefangen, Modus läuft auch ohne Vollbild |
