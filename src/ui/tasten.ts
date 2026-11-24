import { useEffect } from 'react';
import { useProjekt } from '../store/projektStore';
import { usePlayer } from '../store/player';
import { useSchnitt } from '../store/schnitt';
import {
  hatPunkte,
  setzeInPunkt,
  setzeOutPunkt,
  speichereClipAusPunkten,
  trimmeAuswahlAufPosition,
} from '../schnitt/aktionen';
import {
  bildSchritt,
  istProgramm,
  springeRelativ,
  toggleWiedergabe,
} from '../wiedergabe/transport';
import { setzeTag, zuordnungTaste } from '../tagging/aktionen';
import { useTagging } from '../store/tagging';
import { useUi } from '../store/ui';
import { beendePraesentation, naechsterEintrag } from '../praesentation/aktionen';
import { schalteLogo, schalteScoreboard } from '../overlay/aktionen';
import { schalteTafel } from '../taktik/aktionen';
import { useProgramm } from '../store/programm';
import { useZeichnen } from '../store/zeichnen';
import {
  fuegeAusZwischenablageEin,
  kopiereAuswahl,
  loescheAuswahl,
  schliesseZone,
} from '../zeichnen/aktionen';
import { naechstesTempo } from '../video/bildmathe';
import { aufAllenFenstern } from '../layout/fenster';

const istEingabe = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Globale Tastatur: Undo/Redo, Player. Spielposition kommt aus dem Player-Store. */
export function useEditorTasten() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const st = useProjekt.getState();
      const mod = e.ctrlKey || e.metaKey;
      // Präsentationsmodus: nur Navigation, Pause, Live-Zeichnung löschen, Beenden (auch für Presenter-Fernbedienungen)
      if (useUi.getState().praesentation) {
        if (mod || e.altKey) return;
        const k = e.key;
        if (k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown') naechsterEintrag(1);
        else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') naechsterEintrag(-1);
        else if (k === ' ') toggleWiedergabe();
        else if (k.toLowerCase() === 'c') useUi.getState().loescheLive();
        else if (k === 'Escape') beendePraesentation();
        else return;
        e.preventDefault();
        return;
      }
      if (mod && !istEingabe(e.target)) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          st.undo();
          return;
        }
        if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          st.redo();
          return;
        }
      }
      if (istEingabe(e.target) || e.altKey) return;
      // Zuordnung nach dem Taggen (Team 1/2, Nummer, Enter) – Wiedergabe läuft weiter
      if (
        useTagging.getState().zuordnung &&
        !mod &&
        /^(\d|Enter|Tab|Escape|Backspace)$/.test(e.key)
      ) {
        if (zuordnungTaste(e.key)) {
          e.preventDefault();
          return;
        }
      }
      // Logo (L) und Spielstand (S) umschalten – in jeder Ansicht
      if (!mod && !e.repeat && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'l' || k === 's') {
          e.preventDefault();
          if (k === 'l') schalteLogo();
          else schalteScoreboard();
          return;
        }
      }
      // Taktiktafel (T): im Clip ein-/ausblenden, sonst Tafel-Editor
      if (
        !mod &&
        !e.repeat &&
        !e.shiftKey &&
        e.key.toLowerCase() === 't' &&
        !useProjekt.getState().projekt?.tagDefinitionen.some((d) => d.hotkey?.toLowerCase() === 't')
      ) {
        e.preventDefault();
        schalteTafel();
        return;
      }
      const programm = istProgramm();
      // Zeichnen im Clip-Editor: Entf, Strg+C/V, Enter (Zone fertig), Esc
      if (programm && useProgramm.getState().art === 'clip') {
        const z = useZeichnen.getState();
        const k = e.key.toLowerCase();
        if (mod && k === 'c' && z.auswahlId) {
          e.preventDefault();
          kopiereAuswahl();
          return;
        }
        if (mod && k === 'v' && z.zwischenablage) {
          e.preventDefault();
          fuegeAusZwischenablageEin();
          return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && z.auswahlId && !z.entwurf) {
          e.preventDefault();
          loescheAuswahl();
          return;
        }
        if (e.key === 'Enter' && z.entwurf?.werkzeug === 'zone') {
          e.preventDefault();
          schliesseZone();
          return;
        }
        if (e.key === 'Escape') {
          if (z.entwurf) z.setzeEntwurf(null);
          else if (z.auswahlId) z.waehle(null);
          else if (z.werkzeug !== 'auswahl') z.setzeWerkzeug('auswahl');
          return;
        }
      }
      if (!programm) {
        // Schneiden: I / O setzen Punkte, Shift+I / Shift+O trimmen den ausgewählten Clip, Enter speichert
        const k = e.key.toLowerCase();
        if (!mod && !e.repeat && (k === 'i' || k === 'o')) {
          e.preventDefault();
          if (e.shiftKey) trimmeAuswahlAufPosition(k === 'i' ? 'in' : 'out');
          else if (k === 'i') setzeInPunkt();
          else setzeOutPunkt();
          return;
        }
        if (e.key === 'Enter' && !mod && hatPunkte()) {
          if (speichereClipAusPunkten()) e.preventDefault();
          return;
        }
        if (e.key === 'Escape' && useSchnitt.getState().inPunkt !== null) {
          useSchnitt.getState().loeschePunkte();
          return;
        }
        // Tag-Hotkeys
        if (!mod && !e.repeat && e.key.length === 1) {
          const def = st.projekt?.tagDefinitionen.find(
            (d) => d.sichtbar && d.hotkey && d.hotkey.toUpperCase() === e.key.toUpperCase(),
          );
          if (def) {
            e.preventDefault();
            setzeTag(def.id);
            return;
          }
        }
      }
      const p = usePlayer.getState();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggleWiedergabe();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const r = e.key === 'ArrowRight' ? 1 : -1;
          if (mod) springeRelativ(r * 10);
          else if (e.shiftKey) springeRelativ(r * 2);
          else bildSchritt(r);
          break;
        }
        case ',':
          if (!programm) p.setTempo(naechstesTempo(p.tempo, -1));
          break;
        case '.':
          if (!programm) p.setTempo(naechstesTempo(p.tempo, 1));
          break;
      }
    };
    return aufAllenFenstern('keydown', h);
  }, []);
}
