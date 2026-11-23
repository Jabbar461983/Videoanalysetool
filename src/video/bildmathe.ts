/** Reine Hilfsfunktionen für bildgenaue Zeit (testbar ohne Browser). */
export const EPS = 1e-4;

export const zeitZuFrame = (t: number, fps: number): number => Math.floor(t * fps + EPS);
/** Mitte des Bildes: sicher innerhalb des Frames, wenn der Browser auf currentTime springt. */
export const frameZuZeit = (frame: number, fps: number): number => (frame + 0.5) / fps;

export function schritt(t: number, fps: number, anzahl: number, dauer: number): number {
  const f = Math.max(0, zeitZuFrame(t, fps) + anzahl);
  const letzte = Math.max(0, Math.ceil(dauer * fps - EPS) - 1);
  return frameZuZeit(Math.min(f, letzte), fps);
}
export const begrenze = (t: number, dauer: number): number =>
  Math.min(Math.max(0, t), Math.max(0, dauer));

export function formatZeit(t: number, fps: number): string {
  const frame = zeitZuFrame(Math.max(0, t), fps);
  const fpsR = Math.max(1, Math.round(fps));
  const ganz = Math.floor(frame / fpsR);
  const f = frame - ganz * fpsR;
  const h = Math.floor(ganz / 3600);
  const m = Math.floor((ganz % 3600) / 60);
  const s = ganz % 60;
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${h > 0 ? h + ':' : ''}${p(m)}:${p(s)}:${p(f)}`;
}

export const TEMPI = [0.25, 0.5, 1, 2, 4] as const;
export const naechstesTempo = (aktuell: number, richtung: 1 | -1): number => {
  const i = TEMPI.findIndex((x) => x === aktuell);
  const j = Math.min(TEMPI.length - 1, Math.max(0, (i < 0 ? 2 : i) + richtung));
  return TEMPI[j] ?? 1;
};

/** Zeitpunkte für Vorschaubilder: gleichmässig, höchstens `max`. */
export function vorschauZeiten(dauer: number, max = 200, minAbstand = 5): number[] {
  if (dauer <= 0) return [];
  const n = Math.max(1, Math.min(max, Math.floor(dauer / minAbstand)));
  const schritt = dauer / n;
  return Array.from({ length: n }, (_, i) => Math.min(dauer - 0.01, i * schritt + schritt / 2));
}
