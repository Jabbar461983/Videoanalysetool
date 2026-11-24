# Plan Etappe 9 – Taktiktafel

## Entscheide mit dem Auftraggeber
- **Feldmasse:** «Masse unseres Platzes» als Standard. Die genauen Zahlen liegen noch nicht vor; bis dahin gelten **Platzhalter** (40 × 20 m, Eckenradius 4 m, Tor 1.83 × 1.0 m, Torlinie 3 m von der Bande, Torraum 3.6 × 2.4 m, Bullypunkte 10 m / 5 m, Mittelkreis 3 m), in der App als «nicht bestätigt» markiert. Quelle der Platzhalter: eigene Annahme, **nicht** aus einem Streethockey-Regelwerk. Eine Websuche fand nur Werte für Unihockey (40 × 20 m) und Inline-Hockey (40–60 × 20–30 m), keine verlässliche Streethockey-Angabe. Der Verein trägt die echten Masse im Reiter «Taktik → Feldmasse» ein und bestätigt sie.
- **Spieler erkennen:** auf Knopfdruck im Standbild («Alle Spieler erkennen»), zusätzlich «Per Klick übernehmen».

## Ansatz
- **Tafel:** Eine Zeichenfunktion (`src/taktik/tafel.ts`) für Vorschau, Export, Editor und PNG. Feld in Metern, Marker (Team 1/2, Ball) mit Nummer aus dem Kader, Pfeile (Laufweg gestrichelt weiss, Pass gold, Schuss rot).
- **Im Video:** `renderFrame()` zeichnet die Tafel (Bild-im-Bild in wählbarer Ecke und Grösse, «geteilt», Vollbild) für Zeitabschnitte des Clips (Overlay-Spur «Taktik», Hotkey T). Dadurch ist sie auch im Export enthalten.
- **Kalibrierung:** Homographie Bild → Feld aus 4 oder mehr angeklickten Referenzpunkten (Methode der kleinsten Quadrate, normierte Koordinaten), Kontrolllinien im Bild, Fehler in Metern ab 5 Punkten; pro Quelle/Kameraeinstellung gespeichert.
- **Situation übernehmen:** Personen im ganzen Bild erkennen (RT-DETR aus Etappe 8, in 640-px-Kacheln für kleine Spieler), Fusspunkte über die Kalibrierung aufs Feld, Spieler ausserhalb des Feldes (Zuschauer) fallen weg; Teams per k-means auf der Trikotfarbe (Lab) mit Zuordnung zur näheren Teamfarbe; «Teams tauschen» im Editor.
- **Animation:** Zwei Situationen pro Abschnitt: Marker mit gleicher Id gleiten (in den ersten 80 % der Abschnittsdauer), ein-/ausblendende Marker ohne Gegenstück. «Duplizieren» behält die Marker-Ids.

## Grenzen (bewusst)
- **«Geteilt» deckt die rechte Bildhälfte zu** (Tafel über 42 % der Breite), das Video wird nicht verkleinert, weil die Zeichnungen und Spieler-Effekte in Bildkoordinaten laufen.
- Die Tafel kennt keine krummen Pfeile (nur gerade).
- Feldmasse nicht aus einem Regelwerk geprüft (siehe oben).
- Spielererkennung auf der CPU ca. 10–20 s je Bild; Trikotfarben bei ähnlichen Farben nicht trennbar (Hinweis, manuell zuordnen).
