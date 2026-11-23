import { useDateien } from '../store/dateien';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { begrenze, frameZuZeit, schritt, zeitZuFrame } from '../video/bildmathe';
import { Mixer } from '../audio/mixer';
import { baueProgrammPlan } from './plan';
import { Programmspieler } from './programmspieler';
import { segmentZuQuellZeit, type Zeitplan } from './zeitachse';

/** Ein gemeinsamer Programmspieler für Clip- und Playlist-Wiedergabe. */
export const spieler = new Programmspieler(
  (id) => useDateien.getState().urls[id],
  (seg) => {
    if (seg?.quelleId) useProgramm.getState().setzeAnzeigeQuelle(seg.quelleId);
  },
  (m) => useProgramm.getState().setzeFehler(m),
);

/** Ton-Mixer: Kommentare, Ducking, Solo/Stumm in Clip- und Playlist-Wiedergabe. */
export const mixer = new Mixer(() => {
  const plan = aktuellerPlan();
  const projekt = useProjekt.getState().projekt;
  return plan && projekt ? { plan, projekt } : null;
});
spieler.audio = {
  spielt: (z) => void mixer.spielt(z),
  steht: () => mixer.steht(),
  takt: (z) => mixer.takt(z),
};

export const istProgramm = (): boolean => useProgramm.getState().art !== 'quelle';

export function aktuellerPlan(): Zeitplan | null {
  const g = useProgramm.getState();
  return baueProgrammPlan(useProjekt.getState().projekt, g.art, g.clipId, g.playlistId);
}

function aktiveQuelleObjekt() {
  const p = useProjekt.getState().projekt;
  return p?.quellen.find((q) => q.id === p.aktiveQuelleId) ?? p?.quellen[0];
}

/** fps für Bildschritte: im Programm die Quelle des aktuellen Segments, sonst die aktive Quelle. */
export function aktuelleFps(): number {
  const p = useProjekt.getState().projekt;
  const id = useProgramm.getState().anzeigeQuelleId;
  return p?.quellen.find((q) => q.id === id)?.fps ?? aktiveQuelleObjekt()?.fps ?? 25;
}

export function toggleWiedergabe(): void {
  if (istProgramm()) return spieler.umschalten();
  const v = document.querySelector('video');
  if (mixer.kontext) void mixer.resume();
  if (v) {
    if (v.paused) void v.play();
    else v.pause();
  }
}

export function pausiereAlles(): void {
  if (istProgramm()) spieler.pausiere();
  else document.querySelector('video')?.pause();
}

export function springeZu(t: number): void {
  usePlayer.getState().suche(t);
}

/** Gesamtdauer des aktuellen Programms bzw. der aktiven Quelle. */
export function aktuelleDauer(): number {
  if (istProgramm()) return aktuellerPlan()?.dauer ?? 0;
  return aktiveQuelleObjekt()?.dauer ?? 0;
}

export function springeRelativ(sek: number): void {
  const p = usePlayer.getState();
  springeZu(begrenze(p.zeit + sek, aktuelleDauer()));
}

export function bildSchritt(n: number): void {
  pausiereAlles();
  const p = usePlayer.getState();
  const fps = aktuelleFps();
  if (istProgramm()) springeZu(begrenze(p.zeit + n / fps, aktuelleDauer()));
  else springeZu(schritt(p.zeit, fps, n, aktuelleDauer()));
}

/** Aktuelle Quellzeit im Programm (Clip-Editor: «hier Freeze einfügen»). Im Quell-Modus: Position der Quelle. */
export function aktuelleQuellPosition(): {
  quelleId: string;
  quellZeit: number;
  freeze: boolean;
} | null {
  if (!istProgramm()) {
    const q = aktiveQuelleObjekt();
    const v = document.querySelector('video');
    return q
      ? { quelleId: q.id, quellZeit: v ? v.currentTime : usePlayer.getState().zeit, freeze: false }
      : null;
  }
  const plan = aktuellerPlan();
  if (!plan) return null;
  const pos = segmentZuQuellZeit(plan.segmente, usePlayer.getState().zeit);
  return pos ? { quelleId: pos.quelleId, quellZeit: pos.quellZeit, freeze: pos.freeze } : null;
}

export { frameZuZeit, zeitZuFrame };
