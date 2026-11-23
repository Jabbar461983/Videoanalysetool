# Testanleitung Etappe 1 – Tagging & Kader

Voraussetzung: Etappe 0 läuft (Video importiert). Seitenleiste hat jetzt vier Reiter: Quellen · Tags · Clips · Setup.

1. **Teams** (Reiter «Setup»): Team 1 → Kürzel `BUL`, Name «SHC Bulldozers», Farbe wählen. Team 2 → Kürzel `geg` wird zu `GEG`; ein ungültiges Kürzel (z. B. 2 Buchstaben) zeigt eine Meldung. «Als Vorlage speichern» → bei «Standard für neue Projekte?» OK: ein neues Projekt hat dann Team 1 schon ausgefüllt.
2. **Kader**: Nummer, Name, Position eintragen, «Hinzufügen». Oder «Kader aus CSV laden» (Beispiel: Datei mit Zeilen `7;Max Muster;Stürmer`). Doppelte Nummern werden abgelehnt.
3. **Live taggen, nur Tastatur**: Video mit Leertaste starten, dann z. B. `G` (Tor). Unten erscheint die Zuordnung: `1` = Team 1, `7`, `Enter` = Spieler #7. Das Video läuft die ganze Zeit weiter. `Tab` wechselt das Team, `Esc` bricht ab. Weitere Tags: `A` Schuss aufs Tor, `F` Fehler usw. (`?` zeigt alle Tasten). Auf der Timeline erscheint pro Tag eine farbige Marke; Klick springt dorthin.
4. **Tag-Leiste**: dieselben Tags per Mausklick (z. B. am Convertible).
5. **Reiter «Tags»**: Liste aller Tags; Klick = hinspringen und bearbeiten (Team, Spieler, Notiz, Zeit ±1 Bild, Löschen). Filter nach Tag, Team, Spieler; «Filter zurücksetzen».
6. **Reiter «Clips»**: für jeden Tag ein Clip (Name, Zeitraum, Dauer). «Tor» ergibt 8 s vor bis 4 s nach dem Tor.
7. **Playlist-Übernahme**: Filter setzen (z. B. «Tor», Team BUL) → «Treffer in Playlist übernehmen». Sichtbar wird die Playlist erst in Etappe 2.
8. **Eigene Tags** (Setup → Tag-Definitionen): «Eigener Tag», Namen/Farbe/Taste/Vor- und Nachlauf setzen, mit ↑↓ sortieren, Häkchen «In der Leiste zeigen» zum Ausblenden. Doppelte oder vom Programm belegte Tasten melden einen Fehler. Als Tag-Set-Vorlage speichern und in einem anderen Projekt laden.
9. **Neuladen**: Seite neu laden, Projekt öffnen: Tags, Kader, Clips, Filtereinstellungen der Vorlagen sind noch da (das Video musst du ggf. neu verknüpfen). Strg+Z macht Tag-Aktionen rückgängig.

Automatische Tests: `npm test` und `npm run e2e` (vorher `npm run fixtures`).
