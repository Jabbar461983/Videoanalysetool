# Testanleitung Etappe 5 – Audio & Vertonung

Voraussetzung: Etappe 4 läuft. **Kopfhörer aufsetzen** (sonst nimmt das Mikrofon den Videoton mit auf). Chrome oder Edge; beim ersten Mal fragt der Browser nach dem Mikrofon.

1. **Clip öffnen:** Clip wählen → «Zeichnen» (oder im Player auf «Zeichnen») → rechts im Clip-Editor weiter unten **«Ton»**.
2. **Mikrofon:** «Mikrofon aktivieren» → Browser erlauben. Mikrofon in der Liste wählen, in den Pegel sprechen: der Balken soll ausschlagen (grün, bei Übersteuerung rot).
3. **Aufnehmen:** An die gewünschte Stelle der Clip-Zeitleiste klicken (z. B. Anfang oder ein Standbild), dann «Aufnehmen ab Position». Es erscheint **3-2-1** (das Bild steht), danach läuft das Video und die Aufnahme («● REC»). Sprich deinen Kommentar. «Stopp» oder Pause/Ende des Clips beendet. Die Aufnahme steht als blaue Spur mit Wellenform in der Zeitleiste und ist sofort gesichert.
4. **Anhören:** Zeitleiste auf den Anfang, abspielen: Der **Originalton wird leiser**, solange du sprichst, danach wieder lauter. Unter «Ton» lassen sich Absenkung (dB) und Ducking ein-/ausschalten, Lautstärke, **Stumm** und **Solo** je Spur und für den Originalton einstellen.
5. **Standbild:** Füge ein Standbild ein (Reiter Standbild) und nimm einen Kommentar auf, der über das Standbild läuft: Der Originalton schweigt dort (Video steht), dein Kommentar läuft durch.
6. **Bearbeiten:** Aufnahme in der Zeitleiste ziehen (verschieben) oder an den Rändern kürzen; oder Start/Länge als Zahl eingeben. «✕» löscht (Strg+Z holt zurück). «Neu aufnehmen» ersetzt die Aufnahme ab ihrem Start. Mehrere Kommentare lassen sich nacheinander oder parallel auf weiteren Spuren («Neue Spur») aufnehmen.
7. **Neuladen:** Seite neu laden, Video wieder verknüpfen (Reiter «Quellen»), Clip öffnen: Aufnahmen und Wellenform sind noch da.
8. **Playlist:** Clip in die Playlist legen und abspielen: Kommentare und Ducking laufen mit.

**Abnahme:** Über einen Clip mit Standbild sprechen; der Originalton wird leiser, nach Neuladen ist die Aufnahme noch da.

Bitte melde, falls Kommentar und Bild nicht synchron wirken (Gerät und Browser angeben).

Automatische Tests: `npm test`, `npm run fixtures && npm run e2e` (nutzt ein simuliertes Mikrofon).
