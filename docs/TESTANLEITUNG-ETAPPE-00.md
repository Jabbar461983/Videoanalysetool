# Testanleitung Etappe 0

Voraussetzung: Chrome oder Edge. Lokal starten: `npm ci && npm run dev` (oder die Pages-Adresse nach dem Deployment: `https://<nutzer>.github.io/Videoanalysetool/`).

1. **Startseite**: «Neues Projekt» → Editor öffnet. Zurück über «Projekte»: Projekt in der Liste. Umbenennen, Duplizieren, Löschen ausprobieren.
2. **Video importieren**: Spielvideo auf «Videodatei hierher ziehen» ziehen oder «Datei auswählen». Rechts erscheinen Dauer, Auflösung, Bilder/s, Codec, Grösse. Zweite Datei hinzufügen (z. B. 2. Halbzeit), «Aktive Quelle» wechselt die Ansicht.
3. **Abspielen**: Leertaste = Play/Pause. ←/→ = ein Bild. Shift+←/→ = ±2 s, Strg+←/→ = ±10 s. Tempo-Auswahl 0.25× … 4× (oder `,` / `.`). Zeitanzeige zeigt Frames.
4. **Timeline**: Klicken/Ziehen springt. +/− oder Strg+Mausrad zoomt. Nach einigen Sekunden erscheinen Vorschaubilder.
5. **Autosave**: Projektname ändern, Anzeige oben rechts «Speichert …» → «Gespeichert». Strg+Z / Strg+Y rückgängig / wiederholen. Tab schliessen, neu öffnen: Projekt und Abspielposition sind da. Bei der Quelle steht «Datei fehlt» oder sie ist automatisch verknüpft (Chrome/Edge: «Datei erneut auswählen» → Berechtigung bestätigen).
6. **Absturz simulieren**: im Editor ändern, sofort Tab über den Task-Manager beenden. Beim nächsten Start: Hinweis «Letzten Stand wiederherstellen», falls etwas fehlt.
7. **Speicher**: unten auf der Startseite steht der belegte Speicher und ob er dauerhaft gesichert ist.
8. **Hinweise**: `?` zeigt Tastenkürzel. Beim ersten Start in Safari/Firefox erscheint der Hinweisdialog zu fehlenden Funktionen.
9. **Proxy** (nur bei nicht abspielbarem Codec, z. B. HEVC unter Windows ohne Erweiterung): Meldung im Player → «Proxy-Datei erzeugen».

## Abnahme mit 90-Min.-Datei (bitte bei dir lokal)

- Datei (1080p, mehrere GB) in Chrome/Edge importieren: Metadaten sollen in < 5 s erscheinen, Abspielen sofort starten.
- Timeline-Scrubbing: ruckelfrei. Im Task-Manager (Shift+Esc in Chrome) bleibt der Tab-Speicher nach Minuten Scrubbing stabil.
- Tab schliessen und neu öffnen: Projekt ist da, Video wird wieder verknüpft.

Automatische Tests: `npm test` (Unit), `npm run fixtures && npm run e2e` (E2E; ffmpeg nötig).
