# Plan: Vergleich (zwei Szenen nebeneinander)

**Ziel:** Gutes und schlechtes Bully (o. Ä.) nebeneinander zeigen, nacheinander oder gleichzeitig abspielen.

- **Datenmodell (Schema v10):** Playlist-Eintrag `typ: 'vergleich'` mit `links`/`rechts` (Clip, Beschriftung, Farbe, Anker), `ablauf` (nacheinander | gleichzeitig), `zugabe`, `pause`, `abdunklung`, `darstellung` (einpassen | fuellen). Migration 9 → 10 ohne Datenänderung.
- **Zeitplan (`zeitachse.ts`):** Abschnitte der Art `vergleich` mit dem Zustand beider Seiten (läuft von…bis oder steht auf einem Bild, Abdunklung). Nacheinander: links läuft (rechts steht abgedunkelt auf der Ausgangslage), Pause, rechts läuft (links steht abgedunkelt auf dem letzten Bild), optional Zugabe: beide gleichzeitig (Anker fallen zusammen). Zeitlupe und Standbild der Clips werden berücksichtigt.
- **Rendering (`render/vergleich.ts`):** gemeinsame Geometrie der Hälften (Vorschau per CSS, Export per Canvas), Abdunklung, Beschriftung, goldener Rahmen um die laufende Seite.
- **Vorschau (`programmspieler.ts`):** beide Videoelemente nebeneinander; nur die laufende Seite spielt und ist die Uhr.
- **Export (`exportWorker.ts`):** je Seite ein eigener Decoder-Strom bzw. ein Standbild; danach `renderFrame`.
- **Schritt 2:** `ton` (aktiv | links | rechts | stumm; Vorschau über `muted` je Element und Gain-Kurve, Export über `originalStuecke()` im Mixdown), `anordnung` (nebeneinander | uebereinander | ueberblendet) mit `mischung`; Überblendet erzwingt gleichzeitigen Ablauf.
- **Grenzen:** keine Kommentarspuren im Vergleich; Scoreboard im Vergleich aus; Zeichnen/Spieler-Markierungen pro Seite offen.
