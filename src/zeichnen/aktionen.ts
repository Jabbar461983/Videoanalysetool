import type { ZeichenAnimation, Zeichnung, ZeichenStil } from '../model/typen';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useZeichnen } from '../store/zeichnen';
import { aktuellerPlan } from '../wiedergabe/transport';
import { schalteGebogen } from './geometrie';
import { animationFuer, ebene, kopiereZeichnung } from './logik';

export const aktuelleClipId = (): string | undefined => {
  const g = useProgramm.getState();
  return g.art === 'clip' ? g.clipId : undefined;
};

export function fuegeZeichnungHinzu(z: Zeichnung): void {
  useProjekt.getState().aendere('Zeichnung', (p) => {
    p.zeichnungen.push(z);
  });
  useZeichnen.getState().waehle(z.id);
}

export function ersetzeZeichnung(z: Zeichnung, name = 'Zeichnung ändern'): void {
  useProjekt.getState().aendere(name, (p) => {
    const i = p.zeichnungen.findIndex((x) => x.id === z.id);
    if (i >= 0) p.zeichnungen[i] = z;
  });
}

/** Ändert Felder der ausgewählten Zeichnung (ein Undo-Schritt). */
export function aendereAuswahl(name: string, fn: (z: Zeichnung) => void): void {
  const id = useZeichnen.getState().auswahlId;
  if (!id) return;
  useProjekt.getState().aendere(name, (p) => {
    const z = p.zeichnungen.find((x) => x.id === id);
    if (z) fn(z);
  });
}

export function loescheAuswahl(): void {
  const id = useZeichnen.getState().auswahlId;
  if (!id) return;
  useProjekt.getState().aendere('Zeichnung löschen', (p) => {
    p.zeichnungen = p.zeichnungen.filter((x) => x.id !== id);
  });
  useZeichnen.getState().waehle(null);
}

export function kopiereAuswahl(): void {
  const id = useZeichnen.getState().auswahlId;
  const z = useProjekt.getState().projekt?.zeichnungen.find((x) => x.id === id);
  if (z) useZeichnen.getState().setzeZwischenablage(JSON.parse(JSON.stringify(z)));
}

export function fuegeAusZwischenablageEin(): void {
  const z = useZeichnen.getState().zwischenablage;
  const clipId = aktuelleClipId();
  const dauer = aktuellerPlan()?.dauer ?? 0;
  if (!z || !clipId) return;
  const kopie = {
    ...kopiereZeichnung(z, Math.min(usePlayer.getState().zeit, Math.max(0, dauer - 0.2)), dauer),
    clipId,
  };
  fuegeZeichnungHinzu(kopie);
  // Die Zwischenablage rückt mit, damit mehrfaches Einfügen nicht übereinander landet
  useZeichnen.getState().setzeZwischenablage(kopie);
}

export function ebeneAendern(wohin: 'vorn' | 'hinten' | 'hoeher' | 'tiefer'): void {
  const id = useZeichnen.getState().auswahlId;
  if (!id) return;
  useProjekt.getState().aendere('Ebene ändern', (p) => ebene(p, id, wohin));
}

export function schalteGebogenAuswahl(w: number, h: number): void {
  aendereAuswahl('Pfeil biegen', (z) => {
    const neu = schalteGebogen(z as Zeichnung, w, h);
    z.punkte = neu.punkte;
  });
}

/** Stiländerung: Standard-Stil und, falls etwas ausgewählt ist, auch diese Zeichnung. */
export function aendereStil(patch: Partial<ZeichenStil>): void {
  useZeichnen.getState().setzeStil(patch);
  // Nur im Auswahl-Modus wirkt die Leiste auch auf die ausgewählte Zeichnung (sonst gilt sie für die nächste)
  if (useZeichnen.getState().werkzeug !== 'auswahl') return;
  const sel = useZeichnen.getState().auswahlId;
  if (!sel) return;
  const z = useProjekt.getState().projekt?.zeichnungen.find((x) => x.id === sel);
  if (!z) return;
  const p = { ...patch };
  if (z.werkzeug !== 'pfeil') delete p.spitze;
  if (Object.keys(p).length) aendereAuswahl('Stil ändern', (d) => void Object.assign(d.stil, p));
}

/** Zone fertigstellen (≥ 3 Ecken) oder verwerfen. */
export function schliesseZone(): void {
  const st = useZeichnen.getState();
  const e = st.entwurf;
  if (!e || e.werkzeug !== 'zone') return;
  st.setzeEntwurf(null);
  if (e.punkte.length >= 3) fuegeZeichnungHinzu({ ...e, start: e.start, ende: e.ende });
}

/** Animation für neue Zeichnungen und, falls etwas ausgewählt ist, auch für diese. */
export function aendereAnimation(patch: Partial<ZeichenAnimation>): void {
  useZeichnen.getState().setzeAnimation(patch);
  if (useZeichnen.getState().werkzeug !== 'auswahl' || !useZeichnen.getState().auswahlId) return;
  aendereAuswahl('Animation', (d) => {
    d.animation = animationFuer(d.werkzeug, { ...d.animation, ...patch });
  });
}
