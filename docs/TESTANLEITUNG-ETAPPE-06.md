# Testanleitung Etappe 6 – Export, Projektdatei & Präsentationsmodus

Voraussetzung: Etappe 5 läuft. Für den Export am besten Chrome oder Edge (H.264 + AAC). Seite nach dem Deployment mit Strg+F5 neu laden.

## 1. Video exportieren (Reiter «Export»)
1. Reiter **«Export»** öffnen. Wähle **«Gesamtvideo (Playlist)»** (aktive Playlist) oder **«Einzelclip»** und den Clip.
2. Auflösung **1080p** (Standard) oder **720p**. Darunter stehen Grösse, Bildrate (wie die Quelle, höchstens 60), Dauer, geschätzte Dateigrösse und die Codecs (H.264 + AAC; sonst mit Hinweis VP9/Opus).
3. **«Als MP4 exportieren»**: Fortschrittsbalken mit Bildanzahl und **Restzeit**, «Abbrechen» jederzeit. Zuerst wird der Ton gemischt, dann das Video erzeugt.
   - Grosse Exporte (> ca. 150 MB): der Browser fragt nach dem Speicherort, die Datei wird **direkt auf die Festplatte** geschrieben. Kleine Exporte laden als Download.
   - Kodiert dein Gerät langsam (kein Hardware-Encoder), erscheint ein Hinweis mit der geschätzten Gesamtdauer.
4. **Prüfen:** Die Datei in **VLC**, in der **Windows-Fotos-App** bzw. **QuickTime** und auf dem **Handy** abspielen. Titelfolien, Zeichnungen, Logo, Scoreboard, Standbilder, Zeitlupe, Blenden und Kommentar sollen wie in der Vorschau aussehen.

## 2. Aktuelles Bild als PNG
**«Als PNG speichern»**: speichert das gerade sichtbare Bild inkl. Logo, Scoreboard, Zeichnungen (Auflösung bis 1920 Breite).

## 3. Projektdatei (.bdva)
- **Speichern:** Reiter «Export» → «Projekt als .bdva speichern» (oder auf der Startseite bei einem Projekt «Exportieren (.bdva)»). Enthält Projekt, Aufnahmen und Logo, **nicht** die Videos.
- **Öffnen:** Startseite → «Projekt importieren (.bdva)». Es entsteht ein neues Projekt (bei gleicher Id mit «(importiert)»).
- Im Editor erscheint oben der Hinweis **«Videodateien fehlen»**. «Videodateien zuordnen»: **mehrere Dateien auf einmal** auswählen; die App ordnet sie über Dateiname, Grösse und Inhalt zu (auch bei umbenannten Dateien).

## 4. Präsentationsmodus
1. Reiter **«Playlist»** → **«Präsentation starten (Vollbild)»**. Es erscheint nur das Bild, schwarz, bildschirmfüllend.
2. **Bedienen:** →/↓/Bild-ab = nächster Eintrag, ←/↑/Bild-auf = vorheriger (oder Anfang des aktuellen), **Leertaste** = Pause, **Esc** = beenden. Presenter-Fernbedienungen (Bild auf/ab) funktionieren.
3. **Live-Stift:** Mit dem **Stift** direkt auf dem Bild zeichnen (hält das Bild an). Maus/Finger zeichnen, wenn «Live-Stift» in der Leiste eingeschaltet ist. **C** oder «Löschen» entfernt die Zeichnung (auch beim Wechsel des Eintrags). Nichts davon wird gespeichert.
4. Die Steuerleiste blendet sich nach ca. 2.5 s aus und kommt bei Mausbewegung wieder.

**Abnahme:** Eine Playlist mit 10 Clips, Titelfolien, Zeichnungen, Logo, Scoreboard und Kommentar als 1080p-MP4 exportieren und in VLC, QuickTime/Fotos und auf dem Handy abspielen.

Automatische Tests: `npm test`, `npm run fixtures && npm run e2e` (ffmpeg wird für die Prüfung der MP4-Datei benötigt).
