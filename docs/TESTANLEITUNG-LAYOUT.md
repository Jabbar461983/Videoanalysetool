# Testanleitung: Frei anpassbares Layout, zweites Fenster, Präsentation auf dem Beamer

Gilt für Chrome und Edge am Laptop (Fensterbreite über 900 px). Auf Tablets und schmalen Fenstern bleibt die feste Ansicht.

## 1. Module verschieben und in der Grösse ändern
1. Projekt öffnen. Es erscheinen die Module **Video**, **Tag-Leiste**, **Zeitleiste** und rechts die Register **Quellen, Tags, Clips, Playlist, Taktik, Setup, Export**.
2. **Grösse:** Die Linie zwischen zwei Modulen ziehen (sie wird beim Darüberfahren golden).
3. **Verschieben/Andocken:** Den Registerkopf (z. B. «Playlist») ziehen und am Rand eines anderen Moduls loslassen (andocken) oder auf den Kopf einer Gruppe (zum Register machen). Ziehen in die Mitte des Fensters lässt das Modul schweben.
4. Das Layout wird in diesem Browser gemerkt. **Ansicht ▾ → Layout zurücksetzen** stellt den Standard wieder her.

## 2. Menü «Ansicht»
- **Module:** Häkchen blendet ein Modul aus oder wieder ein (Video und Zeitleiste sind Pflicht).
- **Layouts:** «Video gross» (fertig), eigene Layouts: Namen eingeben → «Speichern». Mit dem Namen laden, ⟳ überschreibt mit dem aktuellen Stand, ✎ benennt um, ✕ löscht.
- **Fenster:** «Video auf zweitem Bildschirm», «Alle Fenster zurückholen».

## 3. Zweites Fenster
1. Beim Modul **Video** auf «2. Bildschirm» klicken (oder bei einem beliebigen Modul auf ↗).
2. Beim ersten Mal fragt der Browser nach der Erlaubnis «Fensterverwaltung» (damit das Fenster direkt auf dem zweiten Bildschirm erscheint) und evtl. nach Pop-ups. Ohne Erlaubnis ziehen Sie das Fenster selbst.
3. Im Fenster: «Vollbild» und «Zurück ins Hauptfenster». Tastenkürzel (Leertaste, Pfeile, Tag-Tasten) gelten in beiden Fenstern. Schliessen des Fensters holt das Modul zurück; die Wiedergabeposition bleibt erhalten.

## 4. Präsentation auf dem zweiten Bildschirm
1. Tab **Playlist** → «Präsentation auf zweitem Bildschirm».
2. **Beamer-Fenster:** nur das Bild (Video, Overlays, Titelfolien), ohne Bedienelemente. Für Vollbild im Beamer-Fenster doppelklicken oder F11 (oder im Steuerpult «Beamer-Vollbild»).
3. **Hauptfenster = Steuerpult:** Spiegelbild, Playlist mit aktuellem Eintrag (anklickbar), Vor/Zurück/Pause, **Live-Stift** (Farben, «Löschen»). Gezeichnet wird auf dem Spiegelbild; im Beamer-Fenster erscheint es sofort. Die Live-Zeichnung wird nicht gespeichert.
4. **Tonausgabe:** Auswahlfeld (z. B. HDMI-Beamer), nur Chrome/Edge. Die Namen der Geräte zeigt der Browser erst nach einer Mikrofon-Erlaubnis; sonst heissen sie «Ausgabegerät 1, 2 …».
5. Beenden: «Beenden» im Steuerpult oder Esc. Schliesst man das Beamer-Fenster, endet die Präsentation.

## Grenzen
- Zwei echte Bildschirme, Vollbild auf dem zweiten Bildschirm und Pop-up-Blocker konnten in der Entwicklungsumgebung nicht getestet werden (nur ein zweites Fenster). Bitte einmal mit dem Beamer prüfen.
- Beim Auslagern wird das Video neu geladen; die Position wird danach wiederhergestellt (kurzes Stocken möglich).
- Dialoge (Taktiktafel, Kalibrierung) erscheinen im Hauptfenster.
- Safari/iPad: keine zweiten Fenster, dort bleibt die feste Ansicht.
