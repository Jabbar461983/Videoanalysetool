import { useEffect } from 'react';
import { useProjekt } from '../store/projektStore';
import { usePlayer } from '../store/player';
import { begrenze, naechstesTempo, schritt } from '../video/bildmathe';

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
      const p = usePlayer.getState();
      const q =
        st.projekt?.quellen.find((x) => x.id === st.projekt?.aktiveQuelleId) ??
        st.projekt?.quellen[0];
      if (!q) return;
      const video = document.querySelector('video');
      const fps = q.fps,
        dauer = q.dauer;
      const springe = (t: number) => p.suche(begrenze(t, dauer));
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (video) {
            if (video.paused) void video.play();
            else video.pause();
          }
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const r = e.key === 'ArrowRight' ? 1 : -1;
          if (mod) springe(p.zeit + r * 10);
          else if (e.shiftKey) springe(p.zeit + r * 2);
          else {
            video?.pause();
            p.suche(schritt(p.zeit, fps, r, dauer));
          }
          break;
        }
        case ',':
          p.setTempo(naechstesTempo(p.tempo, -1));
          break;
        case '.':
          p.setTempo(naechstesTempo(p.tempo, 1));
          break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}
