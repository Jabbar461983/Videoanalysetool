import type { MaskenKeyframe, NormRahmen, SpielerObjekt } from '../model/typen';

export const STANDARD_HORIZONT = 0.25;

/** Skalierung eines verschobenen Spielers: weiter oben im Bild (Richtung Horizont) = kleiner. */
export function spielerMassstab(o: SpielerObjekt, kf: MaskenKeyframe): number {
  const manuell = o.massstab ?? 1;
  const p = o.perspektive ?? { an: true, horizont: STANDARD_HORIZONT };
  let s = 1;
  if (p.an) {
    const alt = kf.fuss.y - p.horizont;
    const neu = kf.fuss.y + o.versatz.y - p.horizont;
    if (alt > 0.02) s = Math.min(4, Math.max(0.2, neu / alt));
    else s = 1;
  }
  return Math.min(6, Math.max(0.1, s * manuell));
}

/** Rahmen des Spielers an seiner (verschobenen, skalierten) Position, normiert; Skalierung um den Fusspunkt. */
export function spielerBox(o: SpielerObjekt, kf: MaskenKeyframe): NormRahmen {
  const s = spielerMassstab(o, kf);
  const fx = kf.fuss.x + o.versatz.x;
  const fy = kf.fuss.y + o.versatz.y;
  return {
    x: fx + (kf.box.x - kf.fuss.x) * s,
    y: fy + (kf.box.y - kf.fuss.y) * s,
    b: kf.box.b * s,
    h: kf.box.h * s,
  };
}
