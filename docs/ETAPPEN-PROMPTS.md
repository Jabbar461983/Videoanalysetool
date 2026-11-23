# Etappen-Prompts – Bulldozers Videoanalyse

So gehst du vor:
1. Neues, leeres GitHub-Repository anlegen (Vorschlag: `bulldozers-videoanalyse`).
2. `CLAUDE.md` ins Hauptverzeichnis legen, diese Datei nach `docs/ETAPPEN-PROMPTS.md`. Bulldozers-Logos (PNG, transparent) nach `public/brand/`.
3. In Claude Code das Repo öffnen und die Prompts **einzeln und der Reihe nach** einfügen. Erst zur nächsten Etappe, wenn die Testanleitung der aktuellen Etappe bei dir funktioniert.
4. Ab Etappe 6 ist das Tool im Verein nutzbar. Die Etappen 7–9 bringen die KI-Funktionen und die Taktiktafel.

---

## Etappe 0 – Fundament

```
Lies CLAUDE.md vollständig. Wir starten mit Etappe 0 «Fundament».

Ziel: lauffähiges Grundgerüst, das ein grosses Video importiert und bildgenau abspielt, mit Autosave.

Umfang:
1. Projekt aufsetzen: Vite + React + TypeScript (strict), ESLint, Prettier, Vitest, Playwright. GitHub Action für Build, Tests und Deployment auf GitHub Pages (base-Pfad korrekt setzen).
2. Design-Tokens aus CLAUDE.md Abschnitt 6 als CSS-Variablen (src/styles/tokens.css), Grundlayout im dunklen Theme: Header mit dezentem Doppelstreifen, Videobühne, rechte Seitenleiste (leer, für spätere Panels), Timeline unten. Responsive für Laptop und Tablet.
3. Texte zentral in src/i18n/de-CH.ts.
4. Datenmodell aus Abschnitt 5 als TypeScript-Typen mit Schema-Version und Migrationsgerüst. Zustand-Store mit Command-History (Undo/Redo, Ctrl+Z / Ctrl+Y).
5. Autosave: Dexie/IndexedDB, entprellt (max. 2 s), beim Verlassen der Seite; Startseite mit Projektliste (neu, öffnen, umbenennen, duplizieren, löschen); Wiederherstellung nach Absturz; navigator.storage.persist() anfragen und Speicherplatz anzeigen.
6. Video-Import per Drag & Drop und Dateiauswahl, mehrere Quellen pro Projekt. Metadaten mit Mediabunny lesen. Datei-Handle (File System Access) speichern, wo möglich; sonst beim Öffnen erneut anfordern. Erkennung über Dateiname, Grösse, Teil-Hash (erste und letzte 1 MB).
7. Player: <video> mit Object-URL, Play/Pause (Leertaste), bildweise vor/zurück (Pfeil links/rechts), ±2 s / ±10 s, Geschwindigkeiten 0.25× bis 4×, Zeitanzeige mit Frames.
8. Timeline mit Zoom, Scrubbing und Vorschaubildern (im Worker erzeugt, gecacht).
9. Render-Gerüst: Canvas über dem Video und die zentrale Funktion renderFrame(t, projekt, ziel), die vorerst nichts zeichnet, aber in Vorschau und (später) Export genutzt wird.
10. Feature-Detection (WebCodecs, WebGPU, File System Access, Codec-Support) mit Hinweisdialog. Bei nicht abspielbarem Codec (z. B. HEVC auf Windows ohne Erweiterung): Angebot, mit ffmpeg.wasm eine 1080p-H.264-Proxy-Datei zu erzeugen.

Abnahme:
- Eine 90-Min.-Testdatei (1080p) ist in < 5 s abspielbar, Scrubbing flüssig, Arbeitsspeicher bleibt stabil.
- Tab schliessen und neu öffnen: Projekt ist da, Video wird wieder verknüpft.
- Tests grün, Deployment auf GitHub Pages funktioniert.

Schreibe zuerst docs/plan/etappe-00.md, dann setze um. Am Ende docs/STATUS.md und eine Testanleitung für mich.
```

---

## Etappe 1 – Tagging & Kader

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 1 «Tagging & Kader» um.

Umfang:
1. Teams: zwei Teams pro Projekt mit 3-Buchstaben-Kürzel (Grossbuchstaben, Validierung), Name, Teamfarbe. Vorlage «BUL – SHC Bulldozers» speicherbar für neue Projekte.
2. Kader pro Team: Nummer, Name, Position (Verteidiger, Stürmer, Torhüter); manuell erfassen oder CSV importieren (Spalten Nummer;Name;Position, Trennzeichen ; oder ,). Kader als Vorlage speicherbar.
3. Tag-Leiste mit der festen Streethockey-Liste aus CLAUDE.md 4.2. Jeder Tag hat Farbe, Hotkey, Vorlauf/Nachlauf (Standard 8 s / 4 s), Merkmal «istTor».
4. Eigene Tags anlegen, bearbeiten, sortieren, ausblenden. Tag-Sets als Vorlage speichern.
5. Taggen: Klick oder Hotkey setzt einen Tag an der Abspielposition. Danach optional Team (Taste 1/2) und Spieler (Nummer tippen + Enter) zuordnen, ohne die Wiedergabe zu stoppen. Notiz optional.
6. Tags erscheinen als farbige Marken auf einer eigenen Timeline-Spur; anklicken springt hin; bearbeiten/löschen.
7. Aus jedem Tag entsteht automatisch ein Clip (Zeit − Vorlauf bis Zeit + Nachlauf), sichtbar in einer Clip-Liste (Grundliste reicht, Schnitt-Werkzeuge kommen in Etappe 2).
8. Filter nach Tag, Team, Spieler, Kombination; Ergebnis kann in eine Playlist übernommen werden (Datenstruktur, Oberfläche in Etappe 2).
9. Hotkey-Übersicht per Taste «?».

Abnahme: Ein Spiel lässt sich live mitlaufend taggen, nur mit Tastatur. Nach Neuladen ist alles noch da. Tests grün.
Plan in docs/plan/etappe-01.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 2 – Schneiden, Clips & Gesamtvideo

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 2 «Schneiden & Gesamtvideo» um.

Umfang:
1. Manuelle Clips: In-Punkt (I), Out-Punkt (O), Clip speichern (Enter). Clips trimmen per Ziehen der Ränder in der Timeline und bildgenau per Tastatur.
2. Clip-Bibliothek: umbenennen, duplizieren, löschen, Vorschaubild, Dauer, zugehörige Tags. Clip in einem Clip-Editor öffnen (eigene Timeline nur für diesen Clip).
3. Freeze-Frame: im Clip-Editor an der aktuellen Position ein Standbild von wählbarer Dauer (Standard 3 s) einfügen. Freeze-Frames sind Teil der Clip-Zeitachse; spätere Zeichnungen/Overlays müssen in Freeze-Frames erscheinen können.
4. Zeitlupe als Abschnitt im Clip (z. B. 0.5× für einen Bereich), wird im Export übernommen.
5. Playlist(s): mehrere Playlists pro Projekt, Einträge per Drag & Drop anordnen, Clips und Titelfolien mischen.
6. Titelfolien: Kicker + Titel + optional Untertitel, Dauer, im Bulldozers-Stil (dunkler Grund, Doppelstreifen, Arial Black, Gold-Kicker). Vorschau im Player.
7. Übergang pro Playlist-Eintrag: harter Schnitt oder Blende (0.3 s).
8. Playlist-Vorschau: Playlist nahtlos abspielen (Clip → Titel → Clip).
9. Die Zeitachse eines Clips (inkl. Freeze-Frames, Zeitlupe) wird über eine Funktion clipZeitZuQuellZeit abgebildet, die auch der Export nutzt.

Abnahme: Aus 10 getaggten Szenen entsteht eine Playlist mit Titelfolien, die ohne Ruckler durchläuft. Tests grün.
Plan in docs/plan/etappe-02.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 3 – Zeichenwerkzeuge

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 3 «Zeichnen auf dem Video» um.

Umfang:
1. Werkzeugleiste mit: Pfeil (gerade, gebogen mit Steuerpunkt, durchgezogen/gestrichelt), Linie, Freihand (geglättet), Kreis/Ellipse am Boden (flach, perspektivisch verzerrbar), Zone (Polygon, halbtransparent), Text (mit Hintergrund für Lesbarkeit), Nummer-Marker (Kreis mit Zahl).
2. Stil: Farben Gold, Grün, Weiss, Rot, Blau, Schwarz; Strichstärke; Deckkraft; Pfeilspitzen.
3. Jede Zeichnung gehört zu einem Clip und hat Start/Ende auf der Clip-Zeitachse (Standard: ab jetzt bis Ende des Freeze-Frames bzw. 3 s). Eigene Overlay-Spur in der Clip-Timeline, Zeitspanne per Ziehen änderbar.
4. Animation: Einblenden, Ausblenden, «zeichnet sich» (Pfeil/Linie wächst über wählbare Dauer).
5. Auswählen, verschieben, Punkte bearbeiten, kopieren/einfügen, löschen, Ebenen-Reihenfolge, Undo/Redo.
6. Eingabe über Pointer Events: Maus, Finger, Stift. Beim Stift Handballen ignorieren; Druckstärke optional für Freihand. Zeichnen pausiert die Wiedergabe automatisch, wenn die Einstellung «Beim Zeichnen anhalten» aktiv ist (Standard: an).
7. Gezeichnet wird ausschliesslich in renderFrame(); Koordinaten normiert (0–1) relativ zum Videobild, damit sie bei jeder Auflösung und im Export passen.
8. Vorlagen: häufige Zeichnungen als Favoriten speichern.

Abnahme: Auf einem Convertible lässt sich mit dem Stift ein gestrichelter, animierter Laufweg zeichnen, der zur richtigen Zeit erscheint und verschwindet. Tests grün.
Plan in docs/plan/etappe-03.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 4 – Logo & Scoreboard

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 4 «Overlays» um.

Umfang:
1. Logo oben rechts: Bulldozers-Logo aus public/brand/ (Fallback Platzhalter), Grösse in % der Bildbreite (Standard 10 %), Abstand 2.5 %. Globaler Schalter «Logo anzeigen» und zeitabhängige Abschnitte auf einer Overlay-Spur (pro Clip und für Titelfolien). Logo nie verzerren oder einfärben.
2. Scoreboard oben links: [Teamfarbe-Streifen] KÜR 2 : 1 KÜR [Teamfarbe-Streifen], Kürzel Arial Black weiss, Stand in Gold, Hintergrund #141414 mit leichter Transparenz. Ein-/ausblendbar global und zeitabhängig wie das Logo.
3. Spielstand automatisch: Stand zu Quellzeit t = Startstand + Anzahl Tags mit istTor je Team vor t. Manuelle Korrekturen (Startstand, Korrektur ab Zeitpunkt). In Clips und im Gesamtvideo zeigt das Scoreboard den Stand der jeweiligen Quellzeit; bei Titelfolien wird es ausgeblendet.
4. Einstellungen: Hotkeys L (Logo) und S (Scoreboard) zum schnellen Umschalten.
5. Alles über renderFrame(), damit Vorschau und Export identisch sind.

Abnahme: Nach einem Tor-Tag springt der Stand in den nachfolgenden Clips um; Logo und Scoreboard lassen sich pro Abschnitt ausblenden. Tests (insbesondere Spielstand-Berechnung) grün.
Plan in docs/plan/etappe-04.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 5 – Audio & Vertonung

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 5 «Audio» um.

Umfang:
1. Tonspuren pro Clip: Originalton + beliebig viele Kommentarspuren. Darstellung als Spuren mit Wellenform in der Clip-Timeline.
2. Mikrofonaufnahme: Mikrofon wählen, Pegelanzeige, Countdown 3-2-1, Aufnahme startet an der Abspielposition und läuft mit dem Video mit (MediaRecorder, getUserMedia). Stopp sichert die Aufnahme sofort in IndexedDB.
3. Pro Spur: Lautstärke, Stumm, Solo; Segmente verschieben, kürzen, löschen, neu aufnehmen.
4. Originalton: Lautstärke, stumm, automatisches Absenken während Kommentar (Ducking, einstellbar).
5. Freeze-Frames: Originalton pausiert, Kommentar läuft weiter.
6. Mixdown-Funktion mit OfflineAudioContext, die der Export in Etappe 6 nutzt; Vorschau über Web Audio API synchron zum Video.

Abnahme: Ich kann über einen Clip mit Freeze-Frame sprechen, der Originalton wird leiser, nach Neuladen ist die Aufnahme noch da. Tests grün.
Plan in docs/plan/etappe-05.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 6 – Export, Projektdatei & Präsentationsmodus

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 6 «Export & Präsentation» um. Danach soll das Tool im Verein einsetzbar sein.

Umfang:
1. Export-Pipeline im Worker: Quellframes decodieren (Mediabunny/WebCodecs) → renderFrame() (alle Overlays, Zeichnungen, Titelfolien, Übergänge, Freeze-Frames, Zeitlupe) → VideoEncoder H.264 → AAC-Mixdown aus Etappe 5 → MP4-Mux.
2. Einstellungen: 1080p (Standard) oder 720p; fps der Quelle bis 60; Bitrate automatisch. 4K wird auf 1080p skaliert.
3. Einzelclip exportieren und Gesamtvideo aus einer Playlist exportieren. Fortschritt, Restzeit, Abbrechen. Grosse Exporte direkt in eine Datei schreiben (showSaveFilePicker), sonst Blob-Download. Fallback ohne Hardware-Encoder: Hinweis zur Dauer.
4. PNG-Export des aktuellen Bilds inkl. Overlays.
5. Projektdatei .bdva (ZIP mit projekt.json, Audioaufnahmen, Logos; ohne Quellvideos) exportieren und importieren. Beim Import fehlende Quellvideos anfordern und über Name/Grösse/Teil-Hash zuordnen.
6. Präsentationsmodus: Vollbild, Playlist abspielen, nächster/vorheriger Eintrag (Pfeiltasten, Presenter-Tasten Bild auf/ab), Pause mit Leertaste, Live-Stift zum Zeichnen (wird nicht gespeichert, Taste C löscht). Steuerleiste blendet sich aus.
7. Prüfung: exportierte Datei läuft in VLC, Windows-Fotos-App, QuickTime und auf dem Handy. Vorschau und Export sind deckungsgleich (Playwright-Test vergleicht Pixel an Stichproben).

Abnahme: Eine Playlist mit 10 Clips, Titelfolien, Zeichnungen, Logo, Scoreboard und Kommentar wird als MP4 1080p exportiert und läuft überall. Tests grün.
Plan in docs/plan/etappe-06.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 7 – KI: Spieler per Klick freistellen, hervorheben, umplatzieren

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 7 «Spieler per Klick» um.

Umfang:
1. Modellwahl: Vergleiche 2–3 Segment-Anything-Varianten, die im Browser laufen (z. B. SlimSAM, MobileSAM, EfficientSAM, SAM 2 tiny) auf Qualität bei kleinen Spielern in 1080p-Streethockeyvideos, Ladegrösse und Geschwindigkeit (WebGPU und WASM). Ergebnis und Lizenz in docs/LIZENZEN.md und docs/plan/etappe-07.md begründen.
2. Modell erst beim ersten Gebrauch laden (Fortschrittsanzeige), im Cache API ablegen, Berechnung im Worker. Hinweis, wenn nur WASM verfügbar ist.
3. Klick auf Spieler → Maske. Weitere Klicks: Shift+Klick ergänzt, Alt+Klick entfernt Bereiche. Maske leicht glätten.
4. Effekte: Spotlight (Umgebung mit --bd-scrim abdunkeln, weicher Rand), Ring am Boden unter den Füssen (perspektivisch flach, Farbe wählbar), Kontur, Lupe (vergrösserter Ausschnitt). Kombination möglich, Name/Nummer als Label optional (aus Kader).
5. Umplatzieren: freigestellten Spieler ziehen; alte Stelle füllen (erst zeitlicher Hintergrund aus Nachbarframes, wenn Kamera ruhig; sonst OpenCV.js-Inpainting; LaMa optional, wenn Qualität ungenügend). Optional gestrichelter Pfeil von alt nach neu. Mehrere Spieler gleichzeitig.
6. In dieser Etappe gelten die Effekte im Freeze-Frame-Modus: angewendet im Standbild (Freeze-Frame wird bei Bedarf automatisch eingefügt) und in renderFrame() gezeichnet, damit der Export funktioniert.
7. SpielerObjekt im Datenmodell mit Masken-Keyframes so anlegen, dass Etappe 8 das Tracking ergänzen kann.

Abnahme: Ein Klick auf einen Spieler im Standbild stellt ihn sauber frei; Spotlight und Umplatzieren erscheinen identisch im Export. Tests grün.
Plan in docs/plan/etappe-07.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 8 – KI: automatisches Mitführen (Tracking) mit Fallback

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 8 «Tracking» um.

Ziel: Variante «Automatisch» ist Standard. Wenn sie nicht funktioniert, fällt das Tool sauber auf «Freeze-Frame» (Etappe 7) zurück. Ein Umschalter erlaubt jederzeit den Wechsel.

Umfang:
1. Personendetektor (ONNX, freie Lizenz Apache-2.0/MIT, keine AGPL-Modelle) + Multi-Object-Tracker (z. B. ByteTrack) im Worker, WebGPU bevorzugt. Wahl und Lizenz dokumentieren.
2. Ablauf: Klick auf Spieler → Tracking über den Clip vorwärts (und rückwärts bis Clipstart) vorberechnen, Fortschritt anzeigen, abbrechbar. Ergebnis als Keyframes (Box + Fusspunkt), Maske pro Keyframe mit SAM aus Etappe 7 verfeinern, wo nötig für Spotlight/Kontur.
3. Korrektur: Wenn der Spieler verloren geht oder die Konfidenz fällt, Stelle in der Timeline markieren; Klick auf den Spieler an dieser Stelle setzt das Tracking dort neu an. Keyframes manuell verschiebbar, glätten.
4. Umplatzieren im Automatik-Modus: Versatz gilt über die Zeitspanne, Hintergrund wird pro Frame gefüllt. Wenn die Qualität zu schlecht wird, schlägt das Tool vor, für diese Szene Freeze-Frame zu nutzen.
5. Umschalter «Tracking: Automatisch / Freeze-Frame» in Werkzeugleiste und Einstellungen, pro Spielerobjekt überschreibbar.
6. Automatischer Fallback auf Freeze-Frame mit kurzer Meldung, wenn: kein WebGPU, Benchmark beim ersten Start zu langsam (Schwelle dokumentieren), Tracking-Konfidenz dauerhaft zu tief.
7. Erkannte Spieler pro Frame (Positionen, Teamzuordnung per Trikotfarben-Clustering, manuell korrigierbar) speichern; Etappe 9 nutzt sie für die Taktiktafel.

Abnahme: Ein Spotlight folgt einem Spieler über einen 8-s-Clip in 1080p auf dem Ziel-Laptop; auf einem Gerät ohne WebGPU wird automatisch auf Freeze-Frame umgestellt. Export korrekt. Tests grün.
Plan in docs/plan/etappe-08.md, am Ende STATUS.md und Testanleitung.
```

---

## Etappe 9 – Taktiktafel

```
Lies CLAUDE.md und docs/STATUS.md. Wir setzen Etappe 9 «Taktiktafel» um.

Umfang:
1. Streethockey-Feldskizze als Vektorgrafik im Bulldozers-Stil (dunkel, Linien weiss/Gold, Torräume). Feldmasse konfigurierbar; Standard nach den Spielfeldregeln des internationalen Streethockey-Verbands, Werte prüfen und in docs/plan/etappe-09.md mit Quelle festhalten.
2. Ein-/ausblendbar über dem Video: Bild-im-Bild (Ecke und Grösse wählbar), geteilte Ansicht (Video links, Tafel rechts) oder Vollbild. Zeitabhängig über eine Overlay-Spur, Hotkey T. Im Export enthalten, wenn eingeblendet.
3. Kalibrierung: Im Standbild 4 Referenzpunkte (z. B. Bullypunkte, Torlinien-Ecken, Mittellinie/Bande) anklicken und auf der Skizze zuordnen → Homographie. Kalibrierung pro Kamera-Einstellung speichern, Qualität anzeigen.
4. Spielsituation übertragen: Knopf «Situation übernehmen» projiziert die Fusspunkte aller erkannten Spieler (Etappe 8) bzw. per Klick gewählter Spieler (Etappe 7 oder einfacher Klick ohne KI) auf die Tafel, als Marker in Teamfarbe mit Nummer aus dem Kader. Ball optional per Klick.
5. Auf der Tafel: Marker verschieben, hinzufügen, löschen; Pfeile für Laufweg, Pass, Schuss (gleiche Werkzeuge wie Etappe 3); Situation benennen und speichern; mehrere Situationen pro Clip.
6. Optional: zwischen zwei gespeicherten Situationen animieren (Marker gleiten), für die Teamsitzung.
7. Taktiktafel auch ohne Video nutzbar (leere Tafel), Export als PNG.

Abnahme: Aus einem Standbild wird die Spielsituation mit einem Klick auf die Tafel übertragen, im Bild-im-Bild eingeblendet und mit dem Clip exportiert. Tests grün.
Plan in docs/plan/etappe-09.md, am Ende STATUS.md und Testanleitung.
```

---

## Nach jeder Etappe (Kontroll-Prompt)

```
Prüfe die abgeschlossene Etappe gegen CLAUDE.md und die Abnahmekriterien: Was ist erfüllt, was nicht, welche Grenzen gibt es auf iPad/Android? Laufen Build und alle Tests? Gibt es Stellen, an denen Vorschau und Export voneinander abweichen könnten? Liste offene Punkte in docs/STATUS.md und schlage vor, was vor der nächsten Etappe bereinigt werden soll.
```
