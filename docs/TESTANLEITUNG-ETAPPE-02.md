# Testanleitung Etappe 2 – Schneiden, Clips & Gesamtvideo

Voraussetzung: Etappe 1 läuft, ein Spiel mit mehreren Tags ist geladen. Die Seitenleiste hat jetzt fünf Reiter: Quellen · Tags · Clips · Playlist · Setup.

1. **Clip schneiden:** Video bei der gewünschten Stelle anhalten, `I` drücken (Marke «I» erscheint), später `O`, dann `Enter`. Der Clip erscheint im Reiter «Clips» und als Balken in der Clip-Spur. `Esc` verwirft die Punkte.
2. **Trimmen:** Clip anklicken (Balken wird gold). Ränder an den goldenen Griffen ziehen. Oder: mit ←/→ auf das gewünschte Bild gehen und `Shift+I` (neuer Anfang) bzw. `Shift+O` (neues Ende) drücken. Strg+Z macht es rückgängig.
3. **Bibliothek:** Vorschaubild, Dauer, zugehöriger Tag. Ausgewählten Clip umbenennen, duplizieren, löschen («In Playlist» siehe unten).
4. **Clip-Editor:** «Bearbeiten» → unten erscheint nur die Zeitleiste dieses Clips, oben «Zurück zur Quelle». Mit der Leertaste abspielen.
   - **Standbild:** Zeitleiste anklicken oder anhalten, «Standbild an Position einfügen» (Dauer 3 s, änderbar). Der Clip hält dort das Bild; in der Zeitleiste erscheint ein schraffierter Abschnitt.
   - **Zeitlupe:** Tempo (0.25×/0.5×) und Länge wählen, «Zeitlupe ab Position einfügen». Der Abschnitt wird blau und der Clip länger.
   - Anfang/Ende sind mit ±1-Bild-Knöpfen verschiebbar. «Standbilder» und Zeitlupen lassen sich einzeln entfernen.
5. **Playlist:** Im Reiter «Clips» einen Clip anwählen → «In Playlist». Mehrere Clips hinzufügen. Im Reiter «Playlist»: Einträge per Ziehen (⠿) oder ↑↓ ordnen. «Titelfolie hinzufügen» → Kicker, Titel, Untertitel, Dauer eintragen; «Vorschau im Player» zeigt sie. Pro Eintrag den Übergang wählen (Harter Schnitt / Blende).
6. **Abspielen:** «Playlist abspielen»: Clips, Standbilder und Titelfolien laufen am Stück. Klick in die untere Zeitleiste springt. «Zurück zur Quelle» beendet.
7. **Mehrere Playlists:** «Neue Playlist», oben wechseln, duplizieren, umbenennen, löschen.
8. **Neuladen:** Clips, Playlists und Titelfolien sind danach noch da.

**Abnahme bei dir:** Aus 10 getaggten Szenen eine Playlist mit 2–3 Titelfolien bauen und durchspielen. Es soll ohne Ruckler oder Aussetzer an den Übergängen laufen (besonders Clip → Clip und Clip → Titel). Bitte auch einmal mit zwei Quellen (1./2. Halbzeit) testen. Meldungen dazu bitte mit Gerät und Browser.

Automatische Tests: `npm test`, `npm run fixtures && npm run e2e`.
