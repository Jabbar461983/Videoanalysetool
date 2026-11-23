# Testanleitung Etappe 8 – Automatisches Mitführen

Voraussetzung: Etappe 7 läuft. **Chrome oder Edge mit WebGPU** (Laptop mit Grafikchip). Beim ersten Mal werden das Erkennungsmodell (ca. 21 MB) und das Freistell-Modell geladen (Internet nötig). Seite mit Strg+F5 neu laden.

## 1. Spieler automatisch mitführen
1. Einen Clip öffnen (Tab «Clips» → «Zeichnen»), Werkzeug **«Spieler»** wählen. In der Leiste steht **«Mitführen: Automatisch»**.
2. Im Video auf einen Spieler klicken (am besten auf eine gut sichtbare Trikotfläche, nicht auf einen Schriftzug).
3. Beim allerersten Mal läuft einmalig «Geschwindigkeit des Geräts wird geprüft …». Ist das Gerät schnell genug, erscheint «Spieler wird verfolgt … %» mit **«Abbrechen»**.
4. Danach den Clip abspielen: Spotlight und Ring folgen dem Spieler. Beschriftung optional (Text oder aus dem Kader).

## 2. Korrigieren
- Orange/rote **Marken** in der Timeline (Zeile «Spieler») und im Panel zeigen Stellen, wo die Verfolgung unsicher war oder der Spieler verloren ging.
- An so einer Stelle den Spieler im Panel wählen, im Bild zur Stelle springen und **auf den Spieler klicken**: Das Verfolgen setzt dort neu an.

## 3. Umschalten und Rückfall
- **Mitführen** gibt es in der Werkzeugleiste (neue Spieler), im Reiter «Setup» und pro Spieler im Panel.
- «Freeze-Frame»: Das Video hält an der Klickstelle an (Standbild wird eingefügt); dort gehen auch Kontur, Lupe und Verschieben.
- Ohne WebGPU, bei zu langsamem Gerät, bei zu vielen verlorenen Stellen oder bei Abbruch wechselt das Tool **selbst auf Freeze-Frame** und zeigt kurz den Grund.

## 4. Export
Reiter «Export» → Clip als MP4: Das Spotlight muss dem Spieler auch im Video folgen.

**Abnahme (Ziel-Laptop):** Spotlight folgt einem Spieler über einen **8-Sekunden-Clip in 1080p**; bitte die Dauer des Verfolgens notieren (Anzeige «Spieler wird verfolgt … %»). Auf einem Gerät ohne WebGPU (z. B. iPad/Safari) stellt das Tool automatisch auf Freeze-Frame um.

Automatische Tests: `npm test`; lokal mit Modell: `BM_VIDEO=<Video mit Person> npx playwright test e2e/tracking-auto.spec.ts`.
