# Lizenzen der KI-Modelle und Bibliotheken

Grundsatz (CLAUDE.md): Nur Apache-2.0/MIT, keine AGPL-Modelle. Videos und Bilder verlassen das Gerät nie; nur die Modelldateien werden einmalig von Hugging Face geladen und danach im Browser-Cache (Cache API) gehalten.

## Segmentierung («Spieler per Klick», Etappe 7)

| Modell | Quelle | Lizenz | Grösse | Entscheid |
|---|---|---|---|---|
| **SlimSAM-77 (uniform), q8** | `Xenova/slimsam-77-uniform` | Apache-2.0 | ≈ 14 MB | **Standard** |
| SlimSAM-50 (uniform), q8 | `Xenova/slimsam-50-uniform` | Apache-2.0 | ≈ 35 MB | wählbar, gleiche Qualität, langsamer |
| SAM 2.1 tiny, q4f16 | `onnx-community/sam2.1-hiera-tiny-ONNX` | Apache-2.0 (Upstream Meta; Lizenz-Tag im Repo fehlt) | ≈ 33 MB | nicht gewählt |

### Benchmark (Chromium headless, nur CPU/WASM, 1 Thread, Foto 800×533, Ausschnitt 256 px)

| Modell | Laden | Bild einbetten | Maske | Ergebnis |
|---|---|---|---|---|
| SlimSAM-77 | 3.8 s | 9.8 s | 0.34 s | ganzer Spieler, saubere Kontur |
| SlimSAM-50 | 3.8 s | 15.2 s | 0.37 s | gleiche Maske, 1.5× langsamer |
| SAM 2.1 tiny | 4.1 s | 15.9 s | 0.55 s | nur Teilfläche (in unserer Anbindung nicht brauchbar) |

Begründung: SlimSAM-77 ist am kleinsten und schnellsten bei gleicher Qualität. Mit WebGPU ist das Einbetten deutlich schneller (nicht hier messbar, kein GPU-Adapter in der Testumgebung). Eigene Messung auf eigenem Standbild: `#/benchmark` in der App.

## Bibliotheken

- `@huggingface/transformers` (Apache-2.0), `onnxruntime-web` (MIT): Laufzeit der Modelle, mit der App ausgeliefert (kein CDN).

## Personenerkennung für das Tracking (Etappe 8)

| Modell | Quelle | Lizenz | Grösse | Entscheid |
|---|---|---|---|---|
| **RT-DETR v2 (r18vd), q8** | `onnx-community/rtdetr_v2_r18vd-ONNX` (Basis `PekingU/rtdetr_v2_r18vd`) | Apache-2.0 | ≈ 21 MB | **gewählt** |

Nicht verwendet: YOLOv5/v8/v11 (AGPL-3.0, laut Projektregel ausgeschlossen), DETR-ResNet-50 (zu gross), YOLOX (kein geprüftes Browser-ONNX mit eindeutiger Lizenzangabe auf dem Hub).

Messung (Chromium headless, nur CPU/WASM, 1 Thread, 640×640-Ausschnitt): ca. **1.6 s pro Erkennung**. Das ist für die Automatik zu langsam (Schwelle 600 ms), deshalb gilt: ohne WebGPU oder bei langsamem Schnelltest fällt die App auf Freeze-Frame zurück. Genauigkeit der Spur auf einem Panorama-Testvideo (Fussballfoto, bekannte Geschwindigkeit, 4 s): mittlere Abweichung 1.1 px (Spieler 215×430 px) bzw. 0.5 px (halbe Grösse), 0 Verluste.

Weitere Bibliotheken: `@techstark/opencv-js` (Apache-2.0, Inpainting, Etappe 7), `mediabunny` (MPL-2.0, Decodieren der Clipspanne im Worker).
