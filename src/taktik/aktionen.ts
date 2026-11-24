import { dateiName } from '../export/format';
import { ladeHerunter } from '../export/exportieren';
import type { Situation } from '../model/typen';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { aktuellerPlan } from '../wiedergabe/transport';
import { neueSituation, schalteTafelBei } from './logik';
import { tafelSeitenverhaeltnis, zeichneTafel } from './tafel';

/** Die Situation, die gerade bearbeitet bzw. für neue Abschnitte vorgeschlagen wird (sonst die erste). */
export function aktiveSituation(): Situation | undefined {
  const p = useProjekt.getState().projekt;
  const id = useTaktik.getState().situationId;
  return p?.taktik.situationen.find((s) => s.id === id) ?? p?.taktik.situationen[0];
}

/** Stellt sicher, dass es eine Situation gibt, und gibt ihre Id zurück. */
export function sichereSituation(): string | null {
  const st = useProjekt.getState();
  if (!st.projekt) return null;
  const vorhanden = aktiveSituation();
  if (vorhanden) {
    useTaktik.getState().setze({ situationId: vorhanden.id });
    return vorhanden.id;
  }
  const neu = neueSituation(`Situation ${st.projekt.taktik.situationen.length + 1}`);
  st.aendere('Neue Situation', (p) => {
    p.taktik.situationen.push(neu);
  });
  useTaktik.getState().setze({ situationId: neu.id });
  return neu.id;
}

/**
 * Hotkey T: Im Clip-Editor Tafel ab der Abspielposition ein- bzw. ausblenden;
 * sonst (Quellansicht, ohne Clip) den Tafel-Editor öffnen oder schliessen.
 */
export function schalteTafel(): void {
  const g = useProgramm.getState();
  if (g.art === 'clip' && g.clipId) {
    const plan = aktuellerPlan();
    const id = sichereSituation();
    useProjekt.getState().aendere('Taktiktafel ein-/ausblenden', (p) => {
      const c = p.clips.find((x) => x.id === g.clipId);
      if (c) schalteTafelBei(c, usePlayer.getState().zeit, plan?.dauer ?? 0, id ?? undefined);
    });
    return;
  }
  const t = useTaktik.getState();
  if (!t.editorOffen) sichereSituation();
  t.setze({ editorOffen: !t.editorOffen });
}

/** Die Tafel einer Situation als PNG (ohne Video) speichern. */
export async function exportiereTafelPng(situationId: string): Promise<string | null> {
  const p = useProjekt.getState().projekt;
  const s = p?.taktik.situationen.find((x) => x.id === situationId);
  if (!p || !s) return null;
  const b = 1920;
  const h = Math.round(b / tafelSeitenverhaeltnis(p.taktik.feld));
  const c = new OffscreenCanvas(b, h);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  zeichneTafel(
    ctx,
    p.taktik.feld,
    p.teams,
    { marker: s.marker, pfeile: s.pfeile },
    { x: 0, y: 0, b, h },
  );
  const blob = await c.convertToBlob({ type: 'image/png' });
  const name = dateiName(p.name, `Taktik ${s.name}`) + '.png';
  ladeHerunter(blob, name);
  return name;
}
