import type { FeldMasse } from '../model/typen';
import { invertiere, wendeAn, type Matrix3 } from './homographie';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Zeichnet das Feld (Bande, rote Mittellinie, blaue Linien, Torlinien) mit der Kalibrierung zurück aufs Videobild,
 * damit man sieht, ob die Kalibrierung zu den echten Linien passt. `B`/`H` = Grösse der Zeichenfläche.
 */
export function zeichneFeldAufBild(
  ctx: Ctx,
  Hbf: Matrix3,
  feld: FeldMasse,
  B: number,
  H: number,
): void {
  const inv = invertiere(Hbf);
  if (!inv) return;
  const lin = (pts: [number, number][], farbe: string, breite = 2) => {
    ctx.strokeStyle = farbe;
    ctx.lineWidth = breite;
    ctx.beginPath();
    let erst = true;
    for (const [x, y] of pts) {
      const p = wendeAn(inv, { x, y });
      if (!p) continue;
      if (erst) ctx.moveTo(p.x * B, p.y * H);
      else ctx.lineTo(p.x * B, p.y * H);
      erst = false;
    }
    ctx.stroke();
  };
  const L = feld.laenge;
  const Br = feld.breite;
  lin(
    [
      [0, 0],
      [L, 0],
      [L, Br],
      [0, Br],
      [0, 0],
    ],
    '#BA990E',
    3,
  );
  lin(
    [
      [L / 2, 0],
      [L / 2, Br],
    ],
    '#ff6b6b',
  );
  for (const bx of [L / 2 - feld.blaueLinieAbstand, L / 2 + feld.blaueLinieAbstand])
    lin(
      [
        [bx, 0],
        [bx, Br],
      ],
      '#5b9bff',
    );
  for (const lx of [feld.torLinieAbstand, L - feld.torLinieAbstand])
    lin(
      [
        [lx, 0],
        [lx, Br],
      ],
      'rgba(255,255,255,0.55)',
      1,
    );
}
