import type { MaskenKeyframe, NormRahmen, SpielerObjekt } from '../model/typen';
import { spurBei } from '../ki/spur';
import { clipZeitZuQuellZeit } from '../wiedergabe/zeitachse';
import type { Projekt } from '../model/typen';

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

export interface SpielerGeo {
  /** Rahmen und Fusspunkt (normiert) an der aktuellen Position */
  box: NormRahmen;
  fuss: { x: number; y: number };
  /** true: Position stammt aus der automatischen Spur */
  auto: boolean;
}

export const istAuto = (o: SpielerObjekt): boolean =>
  o.trackingModus === 'auto' && !!o.spur && o.spur.length > 0;

/**
 * Wo steht der Spieler zur Quellzeit `quellZeit`? Freeze-Frame: markierte Stelle plus Versatz/Perspektive.
 * Automatisch: Spur-Box der Zeit; die beim Klick freigestellte Maske wird um die Fussverschiebung
 * verschoben und mit der Höhe der Spur-Box skaliert.
 */
export function spielerGeo(o: SpielerObjekt, kf: MaskenKeyframe, quellZeit: number): SpielerGeo {
  if (istAuto(o)) {
    const spur = o.spur!;
    const jetzt = spurBei(spur, quellZeit)!;
    const start = spurBei(spur, o.klickZeit ?? spur[0]!.zeit)!;
    const s = Math.min(6, Math.max(0.2, jetzt.h / (start.h || 1)));
    const dx = jetzt.cx - start.cx;
    const dy = jetzt.cy + jetzt.h / 2 - (start.cy + start.h / 2);
    return {
      auto: true,
      fuss: { x: kf.fuss.x + dx, y: kf.fuss.y + dy },
      box: {
        x: kf.fuss.x + dx + (kf.box.x - kf.fuss.x) * s,
        y: kf.fuss.y + dy + (kf.box.y - kf.fuss.y) * s,
        b: kf.box.b * s,
        h: kf.box.h * s,
      },
    };
  }
  return {
    auto: false,
    box: spielerBox(o, kf),
    fuss: { x: kf.fuss.x + o.versatz.x, y: kf.fuss.y + o.versatz.y },
  };
}

/** Quellzeit zu einer Clip-Zeit (0, wenn der Clip fehlt). */
export function quellZeitFuer(projekt: Projekt | null, clipId: string, clipZeit: number): number {
  const c = projekt?.clips.find((x) => x.id === clipId);
  return c ? clipZeitZuQuellZeit(c, clipZeit).quellZeit : 0;
}
