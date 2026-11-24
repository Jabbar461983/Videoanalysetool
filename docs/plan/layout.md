# Plan: Frei anpassbares Layout, zweites Fenster, Präsentation auf dem Beamer

Stand: **umgesetzt** (Phasen 1–5). Die Entscheide des Nutzers: jedes Register einzeln, benannte Layouts, Steuerpult im Hauptfenster, Tonausgabegerät wählbar.

## 1. Ziel
- Alle Module (Bühne mit Video, Tag-Leiste, Zeitleiste, Seitenleisten-Register) in der Grösse anpassbar.
- Module frei verschiebbar und andockbar (nebeneinander, übereinander, als Registerkarten gruppiert, schwebend im Fenster).
- Jedes Modul, v. a. das Video, in ein **eigenes Browserfenster** auslagerbar, das man auf einen zweiten Bildschirm zieht.
- Präsentationsmodus auf dem zweiten Bildschirm (Beamer/TV), das Hauptfenster bleibt Steuerpult.
- Layout wird pro Gerät gemerkt, Standardlayout jederzeit wiederherstellbar.
- Grundsatz 1 (alles im Browser, nichts verlässt das Gerät) bleibt unberührt: zusätzliche Fenster gehören zur selben Seite.

## 2. Befunde aus der Untersuchung
### 2.1 Bibliothek
| | dockview 8.9.1 | flexlayout-react 0.11 | rc-dock 4.1 |
|---|---|---|---|
| Lizenz | MIT | MIT | Apache-2.0 |
| React 19 | ja | ja | ja |
| Andocken/Registerkarten/Grössenänderung | ja | ja | ja |
| Schwebende Fenster | ja | ja (eingeschränkt) | ja |
| Fenster in eigenes Browserfenster auslagern | ja (`addPopoutGroup`) | ja | ja (eingeschränkt) |
| Layout als JSON speichern/laden | ja | ja | ja |
| Eigene Tab-/Kopf-Komponenten | ja | ja | ja |

Empfehlung: **dockview** (MIT, aktiv gepflegt, Auslagerung und Serialisierung eingebaut, kein UI-Look vorgegeben: wir stylen mit unseren Design-Tokens, eckig, Gold als Akzent; passt zu CLAUDE.md «keine UI-Bibliothek mit eigenem Look», weil nur das Gerüst, nicht die Bedienelemente geliefert werden). Rückfall: flexlayout-react.
Eintrag in `docs/LIZENZEN.md` ist vorzunehmen.

### 2.2 Machbarkeitsversuch (ausserhalb des Projekts, Chromium)
Mit dockview-react, React 19, einem laufenden `<video>` und einem Web-Audio-Graphen:
- Video in eigenes Fenster ausgelagert: **läuft weiter** (nicht pausiert, Zeit schreitet fort), dasselbe Element, **kein Neumounten**.
- **Ton** über `createMediaElementSource` und den AudioContext des Hauptfensters bleibt hörbar (Pegel vorher/nachher gleich).
- **Klicks** im ausgelagerten Fenster lösen die React-Handler aus.
- Schliessen des Fensters: Das Modul kehrt ins Hauptfenster zurück, dasselbe Element. **Die Wiedergabeposition sprang dabei zurück** (Medienelement wurde beim Entfernen aus dem geschlossenen Fenster neu initialisiert): Nach dem Auslagern und Zurückholen muss die App die Position neu setzen (`springe(usePlayer.zeit)`).
- **Tastendrücke** im ausgelagerten Fenster erreichen die `window`-Listener des Hauptfensters **nicht**.
- Das Hauptfenster findet das Video nicht mehr per `document.querySelector('video')`.
- Layout (`toJSON`) enthält ausgelagerte Gruppen; Auslagerung braucht eine statische `popout.html` unter dem App-Pfad (`/Videoanalysetool/popout.html`).
- Nicht prüfbar in der Cloud: echte zwei Bildschirme, Vollbild auf dem zweiten Bildschirm, Pop-up-Blocker-Verhalten, Verhalten bei minimiertem Hauptfenster.

### 2.3 Stellen im Code, die vom Hauptfenster ausgehen
| Stelle | Problem | Lösung |
|---|---|---|
| `document.querySelector('video')` (transport.ts, taktik/bild.ts, tagging/aktionen.ts, export/png.ts) | findet Video im Popup nicht | Register der Bühnen-Videoelemente (`bildquelle.ts`): Buehne meldet seine Elemente an |
| `window.addEventListener('keydown')` (tasten.ts, HotkeyHilfe, TafelEditor, PraesentationsLeiste) | Tasten im Popup kommen nicht an | Fensterregister: `aufAllenFenstern('keydown', fn)` hängt an Haupt- und alle ausgelagerten Fenster (neue Fenster automatisch) |
| `requestAnimationFrame` im Programmspieler | wird gedrosselt, wenn das Hauptfenster verdeckt/minimiert ist | rAF des Fensters, in dem die Bühne liegt (`bühne.fenster.requestAnimationFrame`) |
| `window.innerHeight/innerWidth` (Teiler in Editor.tsx) | entfällt mit dockview | – |
| `document.documentElement.requestFullscreen()` (Präsentation) | betrifft nur das Hauptfenster | Vollbild des Fensters der Bühne; Auslösung durch Geste im Zielfenster |
| `fullscreenchange`-Listener auf `document` | nur Hauptfenster | Listener pro Fenster |
| Dialoge (`position: fixed`) wie TafelEditor, Kalibrierung | erscheinen im Hauptfenster, auch wenn das Modul ausgelagert ist | akzeptiert; als Hinweis dokumentiert |
| CSS Modules/Tokens | müssen im Popup vorhanden sein | dockview kopiert Stylesheets; Test mit unserem gebündelten CSS |
| ResizeObserver (Buehne, Timeline, LiveStift) | beobachten Elemente in anderem Dokument | funktioniert in Chromium; im E2E-Test absichern |

### 2.4 Tests und Tabs
Die E2E-Tests wählen Seitenleisten-Register über `getByRole('tab', { name })`. Eigene dockview-Tab-Komponente mit `role="tab"` und `aria-selected`, damit bestehende Tests unverändert bleiben (Ziel: keine Testanpassung ausser Layout-Spezifika).

## 3. Architektur
### 3.1 Module (Panels)
| Panel-ID | Inhalt | Besonderheit |
|---|---|---|
| `buehne` | Video, Overlays, Zeichen-/Spielerebenen, Wiedergabeleiste | `renderer: 'always'` (Wiedergabe darf nie abbrechen); nicht schliessbar, aber auslagerbar |
| `tags` | Tag-Leiste (heute unter dem Video) | eigenes Panel |
| `zeit` | Zeitleiste / Programm-Zeitleiste | `renderer: 'always'` |
| `quellen`, `tags-liste`, `clips`, `playlist`, `taktik`, `setup`, `export` | die heutigen Register der Seitenleiste, einzeln | im Standardlayout alle in **einer** Registergruppe rechts (sieht aus wie heute) |
Kopfzeile (Projektname, Undo/Redo, Status) bleibt fest.

### 3.2 Standardlayout
Wie heute: Bühne links gross, darunter Tag-Leiste, rechts Registergruppe, unten Zeitleiste über die ganze Breite. Das Standardlayout lebt als Code (`layout/standard.ts`) und ist die Wiederherstellung.

### 3.3 Dateien (neu)
- `src/layout/Arbeitsflaeche.tsx`: DockviewReact, Panel-Registry, Theme.
- `src/layout/panels.tsx`: Panel-Komponenten (Wrapper um bestehende Komponenten).
- `src/layout/standard.ts`, `src/layout/speicher.ts` (Speichern/Laden/Validieren in `localStorage`, Version, Fallback auf Standard).
- `src/layout/fenster.ts`: Fensterregister (Haupt + Popups), `aufAllenFenstern()`, Fenster-Platzierung (Window Management API, falls erlaubt).
- `src/layout/bildquelle.ts`: Register der Videoelemente (ersetzt `document.querySelector('video')`).
- `src/layout/Fenstermenue.tsx`: Menü «Ansicht» (Module ein/ausblenden, Layout zurücksetzen, benannte Layouts, «Video in zweitem Fenster»).
- `src/layout/layout.css`: dockview-Theme aus den Design-Tokens.
- `public/popout.html`.
- Feste Ansicht (heutiges CSS-Grid) bleibt als **Tablet-/Handy-Rückfall** (schmal oder Touch ohne Maus): dort kein Andocken/Auslagern.

### 3.4 Speicherung
`localStorage['bdva-layout-v1']` = dockview-JSON ohne ausgelagerte Gruppen (Fenster lassen sich nach einem Neuladen nicht ohne Klick wieder öffnen: Pop-up-Blocker) plus Liste «war ausgelagert» für den Hinweis «Video-Fenster wieder öffnen». Optional benannte Layouts. Nicht im Projekt (gerätebezogen, Grundsatz 1).

## 4. Zweites Fenster
- Knopf «Video in eigenem Fenster» (Panel-Kopf und Menü). Platzierung: mit Erlaubnis (Window Management API, `getScreenDetails`) direkt auf den zweiten Bildschirm; sonst Standardposition, Nutzer zieht das Fenster.
- Vollbild im zweiten Fenster per Doppelklick oder Taste `F`/`F11` (Geste im Zielfenster nötig).
- Beim Auslagern, Schliessen und Zurückholen: `bildquelle` aktualisieren, danach Position neu setzen und ggf. weiterspielen.
- Schliesst der Nutzer das Hauptfenster, schliessen sich die Popups.
- Ton: bleibt im Hauptfenster (AudioContext); Ausgabegerät wählbar über `AudioContext.setSinkId` (nur Chrome/Edge), optional.

## 5. Präsentation auf dem zweiten Bildschirm
Heute: ein Fenster, Vollbild, Bühne füllt alles, Live-Stift auf dem Bild, Bedienleiste blendet sich aus.
Neu: Wahl «Präsentieren auf: dieses Fenster | zweites Fenster».
- **Zweites Fenster:** nur die Bühne (Video, Overlays, Titelfolien, Live-Zeichnung), Vollbild, schwarz, Cursor ausgeblendet.
- **Hauptfenster = Steuerpult:** Playlist mit aktuellem und nächstem Eintrag, Play/Pause, Vor/Zurück (Tasten wie heute), Live-Stift ein/aus, Farbe, «Zeichnung löschen», Vorschau-Spiegel der Bühne (Canvas), auf der **gezeichnet wird**; die Zeichnung erscheint live im Beamerfenster (normierte Koordinaten, wie `LiveStift` heute).
- Präsentation endet mit Esc/Ende-Knopf; Fenster kehrt zurück.
- Der Spiegel ist ein Canvas im Hauptfenster (`drawImage` des Videos je Bild, reduzierte Auflösung), damit das Video nur an einem Ort liegt.

## 6. Phasen (jede einzeln lieferbar und getestet)
1. **Gerüst:** dockview, Panels, Standardlayout im Look von heute, Grössenänderung aller Module, Verschieben/Andocken/Gruppieren, schwebend, Speichern/Zurücksetzen, `role="tab"`-Tabs, Tablet-Rückfall. Alle bestehenden Tests grün.
2. **Fenster-Fundament:** Bildquelle-Register, `aufAllenFenstern` für Tasten, rAF-Fenster, Fullscreen pro Fenster. Noch ohne Popout, aber alle Aufrufer umgestellt (Voraussetzung, in Tests belegbar).
3. **Zweites Fenster:** Popout-Knopf, Platzierung, Rückkehr-Behandlung, Hinweis bei blockierten Pop-ups, E2E-Test mit Playwright-Popup (Video läuft, Taste im Popup, Klick, Schliessen).
4. **Fenstermenü und Layouts:** Module ein/ausblenden, benannte Layouts (falls gewünscht), «Alle Fenster zurückholen».
5. **Präsentation auf 2. Bildschirm:** Steuerpult, Spiegel, Live-Stift, Vollbild im Zielfenster.
6. **Doku/Abschluss:** `docs/TESTANLEITUNG-LAYOUT.md`, STATUS, LIZENZEN.

## 7. Risiken und ehrliche Grenzen
- Zwei echte Bildschirme, Pop-up-Blocker, Vollbild auf dem zweiten Bildschirm und Verdecken/Minimieren des Hauptfensters sind in der Cloud-Umgebung **nicht prüfbar**. Das Verhalten wird mit einem zweiten Fenster getestet; die Prüfung auf Ihrem Laptop mit Beamer ist Teil der Abnahme.
- Medienelement beim Zurückholen: Position kann zurückspringen → wird per Neu-Positionierung abgefangen (im Versuch beobachtet).
- Touch/iPad: Andocken per Ziehen ist dort unzuverlässig; Safari kann keine echten zweiten Fenster. Rückfall auf die feste Ansicht.
- Zusätzliche Abhängigkeit (≈ 1.9 MB entpackt, im Bundle deutlich kleiner); MIT; Wartungsrisiko gering, Rückfall flexlayout-react.
- Mehr Freiheit = mehr Wege, sich das Layout «kaputt» zu machen: «Layout zurücksetzen» ist immer erreichbar.
- Der Umbau berührt `Editor.tsx`, `Buehne.tsx`, Hotkeys, Präsentation. Deshalb Phase 2 vor dem ersten Popout.

## 8. Entscheide (beantwortet)
- Module: jedes Register einzeln (Standard: alle Register in einer Gruppe rechts).
- Layouts: benannte Layouts speichern, wechseln, umbenennen, löschen; dazu fertige Layouts «Standard» und «Video gross».
- Präsentation auf dem zweiten Bildschirm: Steuerpult im Hauptfenster (Spiegelbild zum Zeichnen, Playlist, Steuerung), Beamer-Fenster zeigt nur das Bild.
- Tonausgabe: Ausgabegerät wählbar (nur Chrome/Edge, `AudioContext.setSinkId`).

## 9. Stand der Umsetzung
- Phase 1: `src/layout/*` (Dockview), `Editor.tsx` (feste Ansicht bleibt unter 901 px Breite).
- Phase 2: `layout/fenster.ts`, `layout/bildquelle.ts`; Tasten, Video-Register, Takt im Fenster der Bühne.
- Phase 3: `layout/popout.ts`, `layout/KopfAktionen.tsx`, `layout/fensterwechsel.ts`, `public/popout.html`. Beobachtung: Beim Auslagern wird die Bühne neu aufgebaut und das Video neu geladen; die Position wird danach wiederhergestellt.
- Phase 4: `layout/Fenstermenue.tsx`, `layout/layouts.ts`.
- Phase 5: `ui/Steuerpult.tsx`, `store/live.ts`, `praesentation/aktionen.ts`, `ui/AudioAusgabe.tsx`.
