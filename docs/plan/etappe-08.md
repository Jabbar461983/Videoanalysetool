# Plan Etappe 8 – Automatisches Mitführen (Tracking)

Ziel: Ein Klick auf einen Spieler im laufenden Clip; Spotlight/Ring/Label folgen ihm automatisch. Fällt etwas aus, greift der Freeze-Frame-Modus aus Etappe 7.

## Technik

- **Detektor:** RT-DETR v2 (r18vd), `onnx-community/rtdetr_v2_r18vd-ONNX`, Apache-2.0, quantisiert ca. 21 MB, transformers.js, Klasse «person». Nicht gewählt: YOLOv5/8/11 (AGPL), YOLOX (kein fertiges Browser-ONNX mit klarer Lizenzangabe auf dem Hub), DETR-ResNet-50 (zu gross).
- **Kleine Spieler:** Es wird nicht das ganze Bild erkannt, sondern ein **Ausschnitt um die vorhergesagte Position** (ca. 4× Spielergrösse, auf 640 px skaliert). So sind auch 20-px-Spieler im 1080p-Weitwinkel gross genug und der Lauf bleibt schnell.
- **Tracker:** ByteTrack-Prinzip (Kalman-Filter mit konstanter Geschwindigkeit, Zuordnung per IoU in zwei Stufen: sichere und schwache Erkennungen), reine TypeScript-Logik, unit-getestet.
- **Bilder holen:** Mediabunny im Worker (Decodieren der Clipspanne, nur die benötigten Bilder, `VideoFrame.close()`), Schrittweite ca. 12 Bilder/s, dazwischen Interpolation.
- **Ablauf:** Klick → vorwärts bis Clipende, rückwärts bis Clipanfang, Fortschritt, Abbrechen. Ergebnis: Spur = Liste (Quellzeit, Box, Fusspunkt, Konfidenz). Verloren = Konfidenz unter Schwelle für mehr als 0.5 s → Marke in der Timeline.
- **Korrektur:** Klick auf den Spieler an einer Stelle setzt die Spur dort neu an (Lauf ab dieser Stelle in beide Richtungen, bis zur nächsten manuellen Stelle).
- **Rendern:** In `renderFrame()` wird die Box zur Zeit `t` aus der Spur interpoliert und geglättet; Spotlight/Ring/Label folgen ihr. Die freigestellte Maske aus dem Klick wird auf die aktuelle Box skaliert (kein SAM pro Bild).
- **Fallbacks auf Freeze-Frame mit Meldung:** kein WebGPU; Schnelltest beim ersten Start zu langsam (Schwelle: Erkennung > 600 ms pro Bild); Konfidenz dauerhaft tief (> 30 % der Spur verloren).
- **Umschalter:** «Automatisch / Freeze-Frame» in der Werkzeugleiste (Standard), in den Einstellungen und pro Spieler überschreibbar.

## Datenmodell (Schema v8)
`SpielerObjekt.spur?: { zeit; box; fuss; konfidenz }[]` (Quellzeit), `spurStatus`, `trackingModus` (bereits vorhanden), Einstellung `trackingModus` (bereits vorhanden).

## Offene Entscheidungen (mit Auftraggeber)
1. Im Automatik-Modus nur Spotlight, Ring und Beschriftung (Maske wird skaliert); **Kontur, Lupe und Umplatzieren nur im Freeze-Frame** (sonst pro Bild eine SAM-Maske bzw. ein Hintergrund nötig).
2. «Alle Spieler pro Frame erkennen und Teams per Trikotfarbe zuordnen» (Punkt 7 der Vorgabe) erst in Etappe 9 beim Übertragen auf die Taktiktafel, weil es dort gebraucht wird.

## Risiken
| Risiko | Gegenmassnahme |
|---|---|
| Kein Streethockey-Material und keine GPU hier | Test mit Fussballfoto und synthetischem Video; Abnahme auf dem Ziel-Laptop (WebGPU) |
| Verwechslung bei Gedränge | Korrekturklick, Marke bei tiefer Konfidenz |
| Torhüter/Helme/Ausrüstung werden schlechter erkannt (COCO) | Ausschnitt + tiefe Schwelle, manuelle Korrektur; ggf. später Feintuning |
| Decodierung grosser Clips | nur Clipspanne, Schrittweite, Abbruch |
