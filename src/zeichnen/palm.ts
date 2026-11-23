/** Handballen-Erkennung: Stift hat Vorrang vor Touch (Pointer-Events). Reine Logik, ohne DOM. */
export interface PalmZustand {
  /** Zeitpunkt (ms) des letzten Stiftkontakts oder -schwebens */
  letzterStift: number;
  /** Ids der gerade aktiven Touch-Zeiger, die zum Zeichnen angenommen wurden */
  touches: Set<number>;
}

export const neuerPalmZustand = (): PalmZustand => ({
  letzterStift: -Infinity,
  touches: new Set(),
});
export const STIFT_SPERRFENSTER_MS = 1500;

export interface ZeigerInfo {
  pointerType: string;
  pointerId: number;
}

/** Stift-Ereignisse (auch Schweben) vermerken, damit nachfolgende Touches als Handballen gelten. */
export function vermerkeStift(ev: ZeigerInfo, z: PalmZustand, jetzt: number): void {
  if (ev.pointerType === 'pen') z.letzterStift = jetzt;
}

/** `true`, wenn dieses Beginn-Ereignis ignoriert werden soll. */
export function ignoriereBeginn(ev: ZeigerInfo, z: PalmZustand, jetzt: number): boolean {
  if (ev.pointerType !== 'touch') return false;
  if (jetzt - z.letzterStift < STIFT_SPERRFENSTER_MS) return true; // Handballen neben dem Stift
  if (z.touches.size > 0 && !z.touches.has(ev.pointerId)) return true; // zweiter Finger (Zoom/Handfläche)
  return false;
}

export function nimmAn(ev: ZeigerInfo, z: PalmZustand): void {
  if (ev.pointerType === 'touch') z.touches.add(ev.pointerId);
}
export function beende(ev: ZeigerInfo, z: PalmZustand): void {
  z.touches.delete(ev.pointerId);
}
