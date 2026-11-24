# Testanleitung Etappe 9 – Taktiktafel

Voraussetzung: Etappe 8 läuft. Seite mit Strg+F5 neu laden. Reiter **«Taktik»**.

## 1. Feldmasse eintragen (einmalig)
Unter «Feldmasse (Meter)» die echten Werte eures Platzes eintragen (Länge, Breite, Eckenradius, Tor, Torraum, Bullypunkte, Mittelkreis) und «Masse stimmen (bestätigt)» anhaken. Bis dahin steht ein Hinweis «Platzhalter».

## 2. Tafel ohne Video
**«Neue Situation»**: Der Tafel-Editor öffnet sich. Werkzeuge: **Team 1 / Team 2 / Ball** (aufs Feld klicken), **Verschieben** (Marker ziehen), **Laufweg / Pass / Schuss** (ziehen), **Entfernen**. Marker wählen: Nummer eintragen oder «Aus Kader …». «Duplizieren» kopiert die Situation (Marker gleiten dann bei der Animation), «Als PNG speichern» exportiert die Tafel.

## 3. Tafel im Video
1. Clip öffnen («Zeichnen»). **T** drückt: Die Tafel erscheint ab der Abspielposition für 8 s als Bild-im-Bild (unten rechts). Nochmals **T** im selben Abschnitt blendet sie aus. Der Abschnitt erscheint als grüner Balken «Taktik» in der Timeline (ziehen zum Verschieben/Verlängern).
2. Im Reiter «Taktik» unter «Anzeige im Video»: Darstellung (Bild-im-Bild, Geteilt, Vollbild), Ecke, Grösse; pro Abschnitt die Situation und optional **«gleitet zu»** einer zweiten Situation (Animation).
3. Export prüfen: Reiter «Export» → MP4: Die Tafel muss wie in der Vorschau im Bild sein.

## 4. Kalibrieren
1. Video an einer Szene anhalten, in der Linien/Punkte des Feldes gut sichtbar sind. «Neu kalibrieren …».
2. Rechts einen Feldpunkt wählen (Standard: die vier Bullypunkte) und im Bild genau dorthin klicken. Nach 4 Punkten zeigen **gelbe Linien** das berechnete Feld: Sie müssen auf den echten Linien liegen. Mit 5 oder mehr Punkten erscheint der Fehler in Metern (gut/mittel/schlecht).
3. «Speichern». Für jede Kameraeinstellung einmal.

## 5. Situation übernehmen
- **«Alle Spieler erkennen»**: Im Standbild (kalibrierte Quelle). Beim ersten Mal lädt das Erkennungsmodell. Danach öffnet sich der **Prüfdialog**: Das Standbild zeigt alle erkannten Personen als Rahmen und das berechnete Feld (gelb = Bande, rot = Mittellinie, blau = blaue Linien; es muss auf den echten Linien liegen). **Klick auf einen Rahmen** schaltet zwischen Team 1, Team 2 und «nicht übernehmen» um. Zuschauer ausserhalb des Feldes, Doppelte und mehr als 12 Spieler sind schon abgewählt (grau gestrichelt). Mit «Teams tauschen» vertauschen Sie die Teams, «… Spieler übernehmen» erzeugt die Situation im Tafel-Editor (Nummern über «Aus Kader …»).
- **«Per Klick übernehmen»**: Füsse der Spieler anklicken (oben Team 1/Team 2/Ball wählen), «Fertig» öffnet den Editor.

**Abnahme:** Aus einem Standbild mit einem Klick (bzw. «Alle Spieler erkennen») die Spielsituation auf die Tafel übertragen, im Bild-im-Bild einblenden und mit dem Clip exportieren. Bitte die **Feldmasse** prüfen und die Stimmigkeit der übertragenen Positionen (stehen die Marker dort, wo die Spieler stehen?).

Automatische Tests: `npm test`, `npm run e2e` (Taktik: `e2e/taktik.spec.ts`).
