import { frameVonVideo } from '../ki/spielerBau';
import { istProgramm, aktuelleQuellPosition, spieler } from '../wiedergabe/transport';
import { holeHauptVideo } from '../layout/bildquelle';

export interface StandbildInfo {
  frame: HTMLCanvasElement;
  quelleId: string;
  quellZeit: number;
}

/** Das gerade sichtbare Videobild (volle Auflösung) samt Quelle und Quellzeit. */
export function aktuellesBild(): StandbildInfo | null {
  const pos = aktuelleQuellPosition();
  const v = istProgramm() ? spieler.aktivesElement : holeHauptVideo();
  if (!pos || !v) return null;
  const frame = frameVonVideo(v);
  return frame ? { frame, quelleId: pos.quelleId, quellZeit: pos.quellZeit } : null;
}
