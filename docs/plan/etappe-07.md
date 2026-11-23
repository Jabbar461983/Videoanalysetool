# Plan Etappe 7 – KI: Spieler per Klick freistellen, hervorheben, umplatzieren

Weiter auf `claude/magical-cerf-nxizu6`. Netzwerk: Für die Modelle wurde eine eigene Cloud-Umgebung «videoanalysetool» mit den Hugging-Face-Hosts freigegeben; die App selbst lädt Modelle erst beim ersten Gebrauch.

## Entscheide

- **Laufzeit:** `@huggingface/transformers` (Apache-2.0) mit `onnxruntime-web`, im Web Worker; WebGPU, sonst WASM. Die ONNX-Runtime-Dateien (`ort-wasm-simd-threaded.jsep.*`) werden **mit der App ausgeliefert** (kein CDN – Datenschutz); nur die Modellgewichte kommen von Hugging Face und landen im Cache der Seite (Cache API), danach läuft alles offline.
- **Modellvergleich:** Ein **Benchmark-Werkzeug in der App** (`#/benchmark`, nicht verlinkt) misst für dieselbe Aufnahme und denselben Klick: Ladegrösse, Ladezeit, Bildcodierung, Maskenberechnung und zeigt die Masken nebeneinander. Verglichen werden: **SlimSAM-77** (14 MB quantisiert), **SlimSAM-50** (35 MB) und **SAM 2.1 tiny** (ca. 35–60 MB). MobileSAM/EfficientSAM haben keine fertig lauffähigen transformers.js-Pakete; sie würden eigene Vor-/Nachverarbeitung brauchen (Aufwand ohne klaren Gewinn gegenüber SlimSAM). Die Ergebnisse stehen in `docs/LIZENZEN.md` und hier; der Benchmark lässt sich mit eigenen Videobildern wiederholen.
- **Kleine Spieler:** Das Modell skaliert Bilder auf 1024 px; ein Spieler von 40 px in 1080p wird so sehr klein. Deshalb codiert die App um den Klick herum einen **Ausschnitt** (Standard 1/4 der Bildbreite, hochskaliert) → deutlich bessere Masken bei kleinen Figuren; die Maske wird danach ins Gesamtbild zurückgesetzt.
- **Bedienung:** Werkzeug «Spieler» im Clip-Editor: Klick auf einen Spieler → Maske; `Shift`+Klick ergänzt, `Alt`+Klick entfernt Bereiche; Maske wird leicht geglättet. Liegt die Position nicht in einem Standbild, wird automatisch eines (3 s) eingefügt (Freeze-Frame-Modus).
- **Effekte** (kombinierbar, in `renderFrame()` gezeichnet → identisch im Export): Spotlight (Umgebung mit `--bd-scrim` abdunkeln, weicher Rand), Ring am Boden (flache Ellipse unter den Füssen, Farbe wählbar), Kontur, Lupe (vergrösserter Ausschnitt), Label (Nummer/Name aus dem Kader).
- **Umplatzieren:** Freigestellten Spieler ziehen; die alte Stelle wird mit Hintergrund gefüllt: zuerst **zeitlicher Hintergrund** (Median aus Nachbarbildern, wenn die Kamera ruhig ist), sonst **OpenCV.js-Inpainting (Telea)**; optional gestrichelter Pfeil alt → neu; mehrere Spieler gleichzeitig.
- **Datenmodell (`SpielerObjekt`):** `clipId`, `start/ende` (Clip-Zeit), `punkte` (Klicks), `trackingModus: 'freeze'`, `effekte`, `versatz?`, `pfeil`, `label`, und **`maskenKeyframes[]`** (Zeit, Rahmen, Maske, Bildausschnitt, Hintergrundfüllung, Fusspunkt) – für Etappe 8 (Tracking) fügt man einfach weitere Keyframes hinzu. Bilddaten liegen als kleine PNG-Data-URLs im Projekt (landen in `.bdva`).
- **Bilder in `renderFrame()`:** `renderFrame` bleibt synchron; die dekodierten Bilder reicht der Aufrufer über `ziel.bilder` herein (Vorschau: Lader im Hauptthread; Export: Lader im Worker).
- Schema-Version 7. Einstellung `samModell` (Standard = Ergebnis des Vergleichs).

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Keine echte Streethockey-Aufnahme in dieser Umgebung | Benchmark mit einem Fussballfoto (viele kleine Spieler, 800×533) + Benchmark-Seite zum Wiederholen mit deinem Video |
| Lange Modellladung/Inferenz auf WASM | Fortschrittsanzeige, Hinweis «nur WASM», Ergebnis wird je Bild zwischengespeichert |
| Grosse Dateien (ORT 28 MB, OpenCV ca. 10 MB) | Nur bei Bedarf geladen (dynamischer Import, Service-Worker-frei im Browser-Cache) |
| Hintergrund-Füllung unsauber | Zwei Verfahren + manuelle Rücknahme (Versatz löschen) |


## Ergebnis Benchmark
Siehe `docs/LIZENZEN.md`. Entscheid: SlimSAM-77 als Standard; SAM 2.1 tiny verworfen. Klick wählt die grösste plausible Maske (Teil/Ganz-Mehrdeutigkeit), Ausschnitt 0.3 × Bildbreite (mind. 256 px).
