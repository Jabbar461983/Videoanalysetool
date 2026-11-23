# Testanleitung Etappe 7 – Spieler per Klick

Voraussetzung: Etappe 6 läuft, ein Clip existiert. Am besten Chrome/Edge mit WebGPU. Beim ersten Freistellen lädt die App das KI-Modell (ca. 14 MB, Internet nötig); danach ist es im Browser gespeichert.

## 1. Spieler freistellen und hervorheben
1. Clip öffnen («Bearbeiten»), im Bild auf eine Szene springen, wo ein Spieler gut sichtbar ist.
2. In der Werkzeugleiste **«Spieler»** wählen. Auf den Spieler klicken (mitten auf den Körper).
3. Es erscheint «KI-Modell wird geladen …» (nur beim ersten Mal), dann «Spieler wird freigestellt …». Ein **Standbild von 3 s** wird eingefügt, der Spieler ist hervorgehoben (Spotlight + Ring).
4. **Korrigieren:** Fehlt ein Teil (z. B. Stock oder Arm): **Shift+Klick** darauf. Zu viel dabei: **Alt+Klick** auf den überzähligen Teil. Auf dem Tablet: «Ergänzen» bzw. «Entfernen» wählen und tippen.
5. Rechts im Panel **«Spieler»**: Effekte ein-/ausschalten (Spotlight, Ring, Kontur, Lupe, Beschriftung), Abdunkelung, Farbe, Name/Nummer (frei oder «Aus Kader»).

## 2. Spieler umplatzieren
1. Spieler im Panel auswählen, **«Verschieben (Ziehen im Bild)»** anhaken. Kurz warten («Alte Stelle wird mit Hintergrund gefüllt …»).
2. Spieler im Bild an die neue Position ziehen. Die alte Stelle zeigt Hintergrund; ein gestrichelter Pfeil führt von alt nach neu («Pfeil alt → neu» abschaltbar).
3. «Zurück an alte Stelle» setzt ihn zurück; **Strg+Z** macht jeden Schritt rückgängig. Mehrere Spieler: einfach weitere anklicken (Verschieben abschalten oder einen anderen Spieler ausserhalb des gewählten anklicken).

## 3. Export prüfen
Reiter «Export» → Clip als MP4 exportieren oder «Als PNG speichern». Das Bild muss mit der Vorschau übereinstimmen.

## 4. Modellvergleich auf eigenem Material
Adresse `…/Videoanalysetool/#/benchmark` öffnen, ein **Standbild aus deinem Spiel** (Screenshot, 1080p) wählen, auf einen kleinen Spieler klicken, «Messung starten». Die Tabelle zeigt je Modell Ladegrösse, Zeiten und die Maske. Bitte Ergebnis (Qualität bei kleinen Spielern, Zeiten mit WebGPU) zurückmelden.

**Abnahme:** 5 verschiedene Spieler aus echten Streethockey-Szenen freistellen, mindestens zwei davon verschieben, MP4 exportieren.

Automatische Tests: `npm test`, `npm run e2e -- spieler` (lädt das Modell aus dem Internet).
