# Plan Etappe 2 – Schneiden, Clips & Gesamtvideo

Weiter auf `claude/magical-cerf-nxizu6`.

## Entscheide

- **Schnitt-Tasten:** `I` In-Punkt, `O` Out-Punkt, `Enter` Clip speichern (nur wenn In/Out gesetzt). Bildgenaues Trimmen eines ausgewählten Clips: Bild positionieren (←/→), dann `Shift+I` / `Shift+O` setzt dessen In/Out auf das aktuelle Bild; zusätzlich ±1-Bild-Knöpfe im Clip-Editor und Ziehgriffe in der Timeline.
- **Datenmodell v3:** `playlist` wird zu `playlisten: Playlist[]` (+ `aktivePlaylistId`); Einträge bekommen `id` und `uebergang`; Titelfolie = Kicker, Titel, Untertitel, Dauer. Clips erhalten `zeitlupen: {von, bis, tempo}[]` (Quellzeit). Migration 2 → 3 übernimmt die bisherige Playlist.
- **Zeitachse eines Clips:** reine Funktionen in `src/wiedergabe/zeitachse.ts` (`clipSegmente`, `clipDauer`, `clipZeitZuQuellZeit`, `playlistZeitplan`). Der Export (Etappe 6) nutzt dieselben Funktionen.
- **Freeze-Frame:** Standbild bei Quellzeit `zeit` für `dauer` s (Standard 3 s), Teil der Clip-Zeitachse; Originalton pausiert (Video steht).
- **Zeitlupe:** Abschnitt `[von, bis]` mit Tempo 0.25× oder 0.5×; Abschnitte dürfen sich nicht überlappen.
- **Blende (Annahme, bitte bestätigen):** «Blende 0.3 s» = Ab-/Aufblende über Schwarz (je 0.15 s am Ende des vorherigen und am Anfang des nächsten Eintrags). So bleibt die Gesamtdauer exakt die Summe der Einträge, und der Export (Etappe 6) kann es 1:1 nachbilden. Echte Überblendung (Crossfade) ist später möglich.
- **Wiedergabe von Clips/Playlists:** `Programmspieler` mit zwei `<video>`-Elementen (Doppelpuffer): das nächste Segment wird auf dem versteckten Element vorbereitet (Quelle, Position), am Übergang wird nur umgeschaltet → keine Ruckler. Freeze/Titel laufen auf virtueller Uhr.
- **Titelfolien** werden von `renderFrame()` gezeichnet (dunkler Grund, Doppelstreifen, Gold-Kicker, Arial Black), damit der Export sie später identisch erzeugt. `renderFrame(t, projekt, ziel)` bekommt dafür `ziel.kontext` (Quelle, Clip oder Playlist).

## Dateien

`src/wiedergabe/{zeitachse,programmspieler,transport}.ts` · `src/render/titelfolie.ts` · `src/schnitt/schnittLogik.ts` · Stores `programm`, `schnitt`, `ui` · UI `ClipListe` (Bibliothek), `ClipEditor`, `PlaylistPanel`, `ProgrammTimeline`, Timeline-Clipspur mit Ziehgriffen · Tests Unit + Playwright.

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Rucklern beim Clipwechsel | Doppelpuffer mit Vorbereitung (Quelle + seek) vor dem Übergang |
| Freeze trifft falsches Bild | Seek auf `zeit` vor dem Halten, Test mit Fixture |
| Mehrere Quellen im Programm | Pro Segment `quelleId`, Element lädt Quelle bei Bedarf; Datei fehlt → Meldung statt Absturz |
| Tasten kollidieren | Tagging-Tasten nur im Quell-Modus; Schnitt-Tasten I/O/Enter reserviert |
