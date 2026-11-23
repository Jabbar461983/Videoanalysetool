# Testanleitung Etappe 4 – Logo & Scoreboard

Voraussetzung: Etappe 3 läuft, ein Spiel mit Teams (Kürzel, Farben) ist geladen.

1. **Logo und Spielstand sehen:** Oben rechts im Video erscheint das Logo (bis das echte Logo in `public/brand/logo-bulldozers.png` liegt, ein Platzhalter), oben links das Scoreboard `BUL 0 : 0 GEG` mit den Teamfarben.
2. **Ein-/Ausschalten:** Taste `L` (Logo) und `S` (Spielstand), oder die Knöpfe «Logo (L)» / «Spielstand (S)» unter dem Video; Reiter «Setup» → «Logo & Spielstand» hat dieselben Haken und die Logo-Grösse.
3. **Automatischer Stand:** Tor-Tag setzen (`G`), dann Team wählen (`1` oder `2`). Ab diesem Zeitpunkt zeigt das Scoreboard den neuen Stand. Scrubbe vor und zurück: der Stand folgt der Position. Im Reiter «Setup» steht «Stand an der aktuellen Position». Tore ohne Team werden nicht gezählt (mit Hinweis).
4. **Zwei Halbzeiten:** Mit zwei Quellen zählen die Tore der 1. Halbzeit in der 2. mit.
5. **Startstand / Korrektur:** «Startstand» setzen (z. B. 3 : 1 bei Spielbeginn aufgezeichnet). Oder an einer Position «Korrektur ab Position setzen» (z. B. 5 : 4): ab dort gilt dieser Stand, spätere Tore zählen darauf weiter. Korrekturen lassen sich entfernen.
6. **In Clips und im Gesamtvideo:** Ein Clip nach einem Tor zeigt den neuen Stand; ein Clip kurz davor den alten. Auch im Standbild und in der Zeitlupe. In der Playlist trägt jeder Clip den Stand seines Spielzeitpunkts.
7. **Pro Abschnitt ausblenden:** Im Clip-Editor («Zeichnen» im Player oder beim Clip) → Abschnitt «Logo & Spielstand im Clip»: Dauer eintragen und «Logo ausblenden ab Position» bzw. «Spielstand ausblenden ab Position». In der Zeitleiste erscheinen rote Balken («Logo aus», «Stand aus»), die du verschieben und an den Rändern ziehen kannst. Entfernen mit «Entfernen».
8. **Titelfolien:** In der Playlist bei einer Titelfolie «Logo auf der Titelfolie» ein-/ausschalten. Das Scoreboard erscheint auf Titelfolien nie.

**Abnahme:** Nach einem Tor-Tag springt der Stand in den nachfolgenden Clips um; Logo und Scoreboard lassen sich pro Abschnitt ausblenden.

Automatische Tests: `npm test`, `npm run fixtures && npm run e2e`.
