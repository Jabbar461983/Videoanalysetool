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
import { useProgramm } from '../store/programm';
import { useZeichnen } from '../store/zeichnen';
import {
  fuegeAusZwischenablageEin,
  kopiereAuswahl,
  loescheAuswahl,
  schliesseZone,
} from '../zeichnen/aktionen';
import { naechstesTempo } from '../video/bildmathe';

const istEingabe = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Globale Tastatur: Undo/Redo, Player. Spielposition kommt aus dem Player-Store. */
export function useEditorTasten() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const st = useProjekt.getState();
      const mod = e.ctrlKey || e.metaKey;
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
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}
