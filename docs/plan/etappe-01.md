# Plan Etappe 1 – Tagging & Kader

Branch: weiter auf `claude/magical-cerf-nxizu6`, Abschluss per Commit (Tag-Push ist in dieser Umgebung nicht möglich).

## Entscheide (aus der Spezifikation abgeleitet, bei Bedarf ändern)

- **Hotkeys der festen Tags** (frei wählbar, keine Kollision mit Player-Tasten und den späteren Etappen-Tasten I, O, L, S, T, C): Tor `G`, Schuss aufs Tor `A`, Schuss neben/geblockt `N`, Bully gewonnen `B`, Bully verloren `V`, Strafe `P`, Powerplay `W`, Boxplay `X`, Konter `K`, Torhüterparade `H`, Ballverlust `U`, Fehler `F`.
- **Zuordnung nach dem Tag** (Wiedergabe läuft weiter): `1`/`2` = Team 1/2 (solange noch kein Team gewählt und noch keine Ziffer getippt), danach Ziffern = Spielernummer, `Enter` = übernehmen, `Tab` = Team wechseln, `Esc` = abbrechen. Ohne Eingabe läuft das Fenster nach 8 s ab; das Tag bleibt.
- **Auto-Clip**: Jedes Tag erzeugt genau einen Clip (`tagId`), Zeit − Vorlauf … Zeit + Nachlauf, begrenzt auf die Quelle. Tag löschen löscht den Auto-Clip. Standard 8 s / 4 s.
- **Vorlagen** (Dexie-Tabelle `vorlagen`): Team (Kürzel, Name, Farbe), Kader, Tag-Set. Je Typ eine als «Standard für neue Projekte» markierbar.
- **Playlist**: Datenstruktur `projekt.playlist` (Clip-Einträge); Etappe 1 hängt gefilterte Clips nur an, Oberfläche folgt in Etappe 2.
- Schema-Version 2 mit Migration (Standard-Tags, `sichtbar`, `fest`).

## Dateien

`src/tagging/{standardTags,kuerzel,csv,zuordnung,tagLogik}.ts` (reine Logik, getestet) · `src/db/vorlagen.ts` · `src/store/tagging.ts` · UI: `Seitenleiste`, `TagLeiste`, `TagListe`, `ClipListe`, `TeamEditor`, `TagDefEditor` · Timeline: Tag-Spur · Tests: Unit + Playwright «Live taggen».

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Hotkeys kollidieren mit Eingabefeldern | Handler ignoriert Eingabefelder; Fokus von Tag-Buttons wird nach Klick gelöst |
| Doppelbelegung Hotkey | Validierung im Editor (inkl. reservierter Tasten) |
| CSV-Varianten (Excel, BOM, Anführungszeichen) | tolerantes Parsen, Testfälle |
