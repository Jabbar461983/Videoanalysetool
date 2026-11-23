# Plan Etappe 4 – Logo & Scoreboard

Weiter auf `claude/magical-cerf-nxizu6`.

## Entscheide

- **Globale Schalter** (`einstellungen.logoAnzeigen`, `scoreboardAnzeigen`, Standard an) plus Hotkeys `L` und `S`; auch als Knöpfe im Player.
- **Zeitabhängig = Ausblend-Abschnitte pro Clip** (`clip.ausblenden.logo/scoreboard`, in Clip-Zeit). Standard ist «immer sichtbar»; eine Overlay-Spur in der Clip-Zeitleiste zeigt die Abschnitte, in denen das Element ausgeblendet ist (ziehen/verschieben wie bei Zeichnungen). Bei Titelfolien gilt ein Schalter «Logo anzeigen» je Folie (Standard an). Die Abschnitte folgen dem Clip bei Standbild/Zeitlupe/Trimmen (Zeitabgleich wie bei Zeichnungen).
- **Scoreboard bei Titelfolien immer aus.** Im Quell-Modus (ohne Clip) zeigt `renderFrame` Logo und Scoreboard nach den globalen Schaltern.
- **Logo:** `public/brand/logo-bulldozers.png`; fehlt die Datei, wird `logo-platzhalter.svg` verwendet. Breite in % der Bildbreite (Standard 10 %), Abstand zum Rand 2.5 % der Bildbreite, Seitenverhältnis bleibt erhalten, keine Einfärbung. Das Bild liefert der Aufrufer über `ziel.logo` (Vorschau: Lader im Hauptthread; Export in Etappe 6: Bitmap im Worker), `renderFrame` bleibt synchron.
- **Scoreboard oben links:** `[Streifen Teamfarbe 1] KÜR 2 : 1 KÜR [Streifen Teamfarbe 2]`, Kürzel Arial Black weiss, Stand Gold, Hintergrund `#141414` leicht transparent.
- **Spielstand** (rein, getestet): Startstand + Tore bis einschliesslich `t` (Tor-Tags mit Team); Quellen zählen in Projektreihenfolge, Tore früherer Quellen (1. Halbzeit) zählen in späteren voll. **Korrekturen** (`{quelleId, zeit, stand}`) setzen den Stand ab diesem Zeitpunkt auf einen festen Wert; spätere Tore zählen darauf weiter. Bei gleichem Zeitpunkt gewinnt die Korrektur. Tore ohne Teamzuordnung werden nicht gezählt (Hinweis in der Oberfläche).
- Im Clip/Gesamtvideo gilt die **Quellzeit** des gezeigten Bildes (bei Standbild die des Standbilds) – über `clipZeitZuQuellZeit`.
- Reihenfolge in `renderFrame`: Titel/Zeichnungen → Logo/Scoreboard → Blende.
- Schema-Version 5.

## Dateien

`src/overlay/{spielstand,ausblenden}.ts` · `src/render/{logo,overlays}.ts` · Erweiterung `renderFrame` · UI: Knöpfe im Player, `OverlayEinstellungen` (Reiter «Setup»), Overlay-Panel im Clip-Editor, Overlay-Spur in `ProgrammTimeline` (gemeinsame `ZeitBalken`-Komponente), Titelfolie-Schalter · Tests Unit + Playwright.

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Logo lädt asynchron, `renderFrame` ist synchron | Lader mit Cache und Neuzeichnen-Ereignis; Export reicht das Bild herein |
| Fehlende PNG-Datei | Fallback auf SVG-Platzhalter (Fehlerereignis des Bildes) |
| Stand falsch bei fehlenden Team-Zuordnungen | Hinweis im Setup («x Tore ohne Team») |
