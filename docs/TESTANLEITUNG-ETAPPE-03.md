# Testanleitung Etappe 3 – Zeichnen auf dem Video

Voraussetzung: Etappe 2 läuft. Gezeichnet wird im **Clip-Editor**. Einstieg: im Player (unter dem Video) auf den grünen Knopf **«Zeichnen»** klicken – er öffnet den Clip an der aktuellen Position (gibt es keinen, entsteht automatisch einer von 4 s davor bis 4 s danach). Oder im Reiter «Clips» bei einem Clip auf «Zeichnen». Über dem Video erscheint dann die Werkzeugleiste (Auswählen, Pfeil, Linie, Freihand, Kreis, Zone, Text, Nummer).

Falls du die Werkzeuge nicht siehst: Seite neu laden (Strg+F5), damit die neueste Version von GitHub Pages geladen wird.

1. **Pfeil:** «Pfeil» wählen, auf dem Video ziehen. «Gestrichelt» anhaken für einen Laufweg. Die Zeichnung erscheint sofort und ist ausgewählt; unten in der Zeitleiste gibt es eine neue Spur «Zeichnungen».
2. **Animation:** In der Leiste «Animation» auf «zeichnet sich» stellen (gilt für die nächsten Zeichnungen) und einen neuen Pfeil ziehen; zum Anfang springen und abspielen: der Pfeil wächst. «Ausblenden» lässt ihn am Ende verblassen.
3. **Zeitspanne:** Balken in der Spur ziehen (verschieben) oder an den Rändern ziehen (länger/kürzer). Oder im Panel unter «Zeichnungen» Start/Ende eintippen. Beim Abspielen erscheint/verschwindet die Zeichnung zu diesen Zeiten.
4. **Weitere Werkzeuge:** Linie, Freihand (Stift: Druck beeinflusst die Breite, abschaltbar), Kreis (ziehen = Radius; danach «Auswählen» und die beiden Griffe ziehen für flache, verzerrte Bodenkreise), Zone (Ecken anklicken, mit Enter / Doppelklick / Klick auf die erste Ecke schliessen), Text (klicken, tippen, Enter), Nummer (klicken; die Nummer zählt hoch und ist im Panel änderbar).
5. **Stil:** Farbe, Stärke, Deckkraft, Pfeilspitzen. Im Modus «Auswählen» ändert die Leiste die ausgewählte Zeichnung.
6. **Bearbeiten:** «Auswählen», Zeichnung anklicken: ziehen = verschieben, Griffe = Punkte ändern. «Gerade ↔ gebogen» biegt Pfeile. Entf löscht, Strg+C / Strg+V kopiert/fügt ein, Strg+Z macht rückgängig. Im Panel: Ebene nach vorn/hinten.
7. **Beim Zeichnen anhalten:** Clip abspielen und mit einem Zeichenwerkzeug aufs Video tippen – die Wiedergabe hält an (Haken «Beim Zeichnen anhalten» abschaltbar).
8. **Standbild:** An einer Stelle ein Standbild einfügen (3 s) und dort zeichnen: die Zeichnung läuft bis zum Ende des Standbilds. Danach vor dem Standbild ein zweites Standbild einfügen: die Zeichnungen bleiben am selben Bild.
9. **Favoriten:** Zeichnung auswählen → «Als Favorit speichern». Später über «Favorit einfügen …» in einem anderen Clip einsetzen.
10. **Playlist:** Clip in die Playlist legen und abspielen: die Zeichnungen erscheinen mit.

**Abnahme auf dem Convertible:** Mit dem Stift einen gestrichelten, animierten Laufweg zeichnen, der zur richtigen Zeit erscheint und wieder verschwindet. Handballen auf dem Display darf nichts zeichnen. Bitte auch mit dem Finger prüfen.

Automatische Tests: `npm test`, `npm run fixtures && npm run e2e`.
