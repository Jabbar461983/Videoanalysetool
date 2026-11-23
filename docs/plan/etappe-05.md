# Plan Etappe 5 – Audio & Vertonung

Weiter auf `claude/magical-cerf-nxizu6`.

## Entscheide

- **Tonspuren gehören zum Clip** (`clip.audio`): Originalton (Lautstärke, Stumm, Solo) + beliebig viele Kommentarspuren (Name, Lautstärke, Stumm, Solo, Segmente). Das bisherige projektweite Platzhalterfeld `audioSpuren` entfällt (Schema-Version 6).
- **Segment** = `{id, blobId, start (Clip-Zeit), offset (Sekunden im Blob), dauer}`. Verschieben ändert `start`, Kürzen ändert `offset`/`dauer` (nie über den Blob hinaus). Aufnahmen liegen als Blobs in IndexedDB (Tabelle `audio`, mit Wellenform-Spitzen), werden **sofort beim Stoppen** gesichert und beim Löschen eines Segments erst beim nächsten Aufräumen (Startseite) entfernt, damit Rückgängig funktioniert.
- **Zeit der Kommentare = Clip-Zeit** (Ausgabezeit inkl. Standbildern und Zeitlupe). Beim Einfügen/Entfernen von Standbild/Zeitlupe oder Trimmen folgt der **Start** eines Segments dem Videobild (wie Zeichnungen); die Länge bleibt.
- **Standbild:** Das Video steht, der Originalton pausiert automatisch, Kommentare laufen weiter.
- **Ducking** (pro Clip einstellbar, Standard an, −12 dB): Während hörbarer Kommentarsegmente wird der Originalton mit kurzer Rampe (0.15 s ab, 0.25 s auf) abgesenkt.
- **Solo:** Ist bei irgendeiner Spur (inkl. Original) Solo gesetzt, sind nur Solo-Spuren hörbar.
- **Vorschau über Web Audio:** beide `<video>`-Elemente laufen über `MediaElementAudioSourceNode` in einen gemeinsamen Gain für den Originalton; Kommentare werden als `AudioBufferSourceNode` zeitgenau geplant. Der Programmspieler meldet Start/Stopp/Sprung; bei Abweichung > 120 ms wird neu synchronisiert. Im reinen Quell-Modus bleibt alles unverändert (Gain 1).
- **Planung rein und getestet:** `audioPlan(plan, projekt)` liefert Kommentar-Ereignisse in Playlist-Zeit und die Gain-Kurve des Originals; Vorschau **und** Mixdown (`mixdownRender`, `OfflineAudioContext`) benutzen dieselbe Planung. Der Export (Etappe 6) liefert zusätzlich die Original-Puffer.
- **Aufnahme:** Mikrofon wählen (`enumerateDevices`), Pegelanzeige (AnalyserNode), Countdown 3-2-1 bei angehaltenem Bild, dann startet `MediaRecorder` zusammen mit der Wiedergabe an der gewählten Position. Pause/Ende der Wiedergabe oder «Stopp» beendet. «Neu aufnehmen» ersetzt ein Segment ab seinem Start. Hinweis: Kopfhörer tragen, sonst nimmt das Mikrofon den Videoton mit auf.
- **Wellenform** in der Clip-Zeitleiste: Originalton (Spitzen aus der Quelldatei, nur der Clipbereich, mit Mediabunny dekodiert und gecacht; während Standbildern leer) und je Kommentarspur die Segmente mit Wellenform; Segmente per Ziehen verschieben bzw. an den Rändern kürzen.
- **Zeitleiste:** `ProgrammTimeline` wird in übereinanderliegende Bereiche (Reihen) umgebaut statt fester Pixelpositionen, damit Tonspuren Platz finden; bei Bedarf scrollt die Zeitleiste vertikal.

## Dateien

`src/audio/{modell,plan,mixer,mixdown,aufnahme,peaks,speicher}.ts` · Dexie-Tabelle `audio` · UI `TonPanel` (Clip-Editor), `AufnahmeLeiste`, `WellenformSpur`, Umbau `ProgrammTimeline` · Tests Unit (Plan, Segmente, Gain, Migration) + Playwright (Fake-Mikrofon).

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| AudioContext startet nur nach Nutzeraktion | `resume()` beim Abspielen/Aufnehmen (Klick/Taste) |
| Drift zwischen Video und Kommentar | Drift-Prüfung im Takt, Neuplanung |
| Echo durch Lautsprecher | Hinweis (Kopfhörer), Mikrofon mit Echounterdrückung angefordert |
| Safari/MediaRecorder-Format | `isTypeSupported` (webm/opus bzw. mp4) |
| Test ohne Mikrofon | Chromium-Fake-Gerät (`--use-fake-device-for-media-stream`) |
