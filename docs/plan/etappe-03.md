# Plan Etappe 3 – Zeichnen auf dem Video

Weiter auf `claude/magical-cerf-nxizu6`.

## Entscheide

- **Zeichnen im Clip-Editor:** Jede Zeichnung gehört zu einem Clip (`clipId`), Start/Ende in **Clip-Zeit** (inkl. Standbildern und Zeitlupe). In der reinen Quell-Ansicht wird nicht gezeichnet. Playlists zeigen die Zeichnungen ihrer Clips mit.
- **Standard-Zeitspanne:** ab der aktuellen Clip-Zeit bis zum Ende des Standbilds, falls dort eines liegt, sonst 3 s (begrenzt auf die Clip-Dauer).
- **Koordinaten normiert (0–1)** relativ zum Videobild; Strichstärken, Schrift und Pfeilspitzen sind in «Pixel bei 1920 Breite» angegeben und skalieren mit der Bildbreite → Vorschau und Export sehen gleich aus.
- **Gezeichnet wird nur in `renderFrame()`** (`src/render/zeichnungen.ts`). Auch die Vorschau während des Zeichnens (Entwurf, Verschieben) läuft über `ziel.zusatz` derselben Funktion. Auswahlgriffe sind reine Bedienelemente (DOM) und nicht Teil des Bildes.
- **Werkzeuge:** Pfeil (gerade oder gebogen mit Steuerpunkt, durchgezogen/gestrichelt, Spitze Ende/beide/keine), Linie, Freihand (RDP-vereinfacht, geglättet, optional Druckstärke bei Stift), Kreis/Ellipse am Boden (Mittelpunkt + zwei konjugierte Halbachsen → flach und verzerrbar), Zone (Polygon, halbtransparent), Text (Hintergrundbox), Nummer-Marker.
- **Animation:** Einblenden, Ausblenden, «zeichnet sich» (Pfad wächst über wählbare Dauer; Zone/Text/Marker blenden stattdessen ein).
- **Bearbeiten:** Auswählen (Klick, Liste, Zeitleisten-Balken), Verschieben, Punkte ziehen, Kopieren/Einfügen (Strg+C/V), Löschen (Entf), Ebenenreihenfolge (nach vorn/hinten), Undo/Redo.
- **Eingabe:** Pointer Events für Maus, Finger, Stift. Stift hat Vorrang: Touch-Eingaben kurz nach Stiftkontakt (Handballen) werden ignoriert; Mehrfinger-Berührungen ebenso. Druckstärke nur Freihand/Stift und abschaltbar.
- **«Beim Zeichnen anhalten»:** Einstellung im Projekt (`einstellungen.zeichnenAnhalten`, Standard an): Beim ersten Kontakt mit einem Zeichenwerkzeug hält die Wiedergabe an.
- **Overlay-Spur** in der Clip-Zeitleiste: Balken je Zeichnung (in Bahnen gestapelt), Ziehen verschiebt, Ränder ziehen ändert die Zeitspanne.
- **Zeitabgleich:** Ändert sich die Clip-Zeitachse (Standbild/Zeitlupe/Trimmen), werden Start/Ende der Zeichnungen so umgerechnet, dass sie am gleichen Videobild bleiben.
- **Favoriten:** Zeichnungen als Vorlage (Dexie `vorlagen`, Typ `zeichnung`) speichern und an der aktuellen Zeit einfügen.
- Schema-Version 4 (neue `Zeichnung`, `zeichnenAnhalten`).

## Dateien

`src/zeichnen/{geometrie,logik,palm}.ts` (rein, getestet) · `src/render/zeichnungen.ts` · `src/store/zeichnen.ts` · UI `Werkzeugleiste`, `ZeichenEbene`, `ZeichnungenPanel`, Überlagerung in `ProgrammTimeline` · Tests Unit + Playwright.

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Stift-/Touch-Verhalten je Gerät verschieden | Reine Logikfunktion für Palm-Rejection mit Tests; Handbuch-Test auf Convertible nötig |
| Treffer auf dünne Linien | Trefferradius in Pixeln (≥ 10 px, 16 px bei Touch) |
| Zeichnung driftet, wenn der Clip geändert wird | Zeitabgleich-Funktion mit Tests |
| Vorschau ≠ Export | Alles über `renderFrame()`; Pixel-Test im E2E |
