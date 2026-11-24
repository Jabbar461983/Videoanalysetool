import { useRef } from 'react';
import { t } from '../i18n/de-CH';
import { entferneSpieler, sichereHintergrund } from '../ki/spielerAktionen';
import { wechsleModus } from '../ki/trackingAktionen';
import { quellZeitFuer, spielerGeo } from '../render/perspektive';
import { istSpielerSichtbar, keyframeBei } from '../render/spieler';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';

const KNOPF = {
  position: 'absolute',
  pointerEvents: 'auto',
  width: 34,
  height: 34,
  minWidth: 34,
  minHeight: 34,
  padding: 0,
  lineHeight: 1,
  fontSize: 18,
  fontWeight: 700,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--bd-surface)',
  color: '#fff',
  border: '1px solid var(--bd-gold)',
} as const;

/** Offene Hand (Griff zum Verschieben). */
function HandSymbol() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="11" width="12" height="11" rx="3.5" />
      <rect x="6" y="4" width="2.7" height="11" rx="1.35" />
      <rect x="9.5" y="2" width="2.7" height="12" rx="1.35" />
      <rect x="13" y="2.5" width="2.7" height="12" rx="1.35" />
      <rect x="16.5" y="5" width="2.7" height="10" rx="1.35" />
      <rect x="2.6" y="12" width="2.7" height="7" rx="1.35" transform="rotate(-28 4 15.5)" />
    </svg>
  );
}

interface Zieh {
  id: string;
  original: { x: number; y: number };
  start: { x: number; y: number } | null;
  letzte: { x: number; y: number };
  bereit: boolean;
}

/**
 * Griffe an jedem sichtbaren, freigestellten Spieler (mit Abstand zu ihm):
 * ✕ rechts oben entfernt die Markierung, die Hand links oben verschiebt den Spieler (nur Freeze-Frame).
 */
export function SpielerKreuze() {
  const projekt = useProjekt((x) => x.projekt);
  const objekte = projekt?.spielerObjekte;
  const clipId = useProgramm((x) => (x.art === 'clip' ? x.clipId : undefined));
  const zeit = usePlayer((x) => x.zeit);
  const ref = useRef<HTMLDivElement>(null);
  const zieh = useRef<Zieh | null>(null);
  if (!objekte || !clipId) return null;
  const sichtbar = objekte.filter((o) => o.clipId === clipId && istSpielerSichtbar(o, zeit));
  if (sichtbar.length === 0) return null;

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const setzeVersatz = (id: string, v: { x: number; y: number }) =>
    useProjekt.getState().aendereStill((d) => {
      const o = d.spielerObjekte.find((x) => x.id === id);
      if (o) o.versatz = v;
    });

  const handDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const o = useProjekt.getState().projekt?.spielerObjekte.find((x) => x.id === id);
    if (!o) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Ereignisse (Tests) */
    }
    const z: Zieh = { id, original: { ...o.versatz }, start: null, letzte: norm(e), bereit: false };
    zieh.current = z;
    // Erst die alte Stelle mit Hintergrund füllen, dann folgt der Spieler dem Zeiger
    void sichereHintergrund(id).then((ok) => {
      if (zieh.current !== z) return;
      z.bereit = ok;
      z.start = z.letzte;
    });
  };
  const handMove = (e: React.PointerEvent) => {
    const z = zieh.current;
    if (!z) return;
    z.letzte = norm(e);
    if (!z.bereit || !z.start) return;
    setzeVersatz(z.id, {
      x: z.original.x + z.letzte.x - z.start.x,
      y: z.original.y + z.letzte.y - z.start.y,
    });
  };
  const handUp = (e: React.PointerEvent) => {
    const z = zieh.current;
    zieh.current = null;
    if (!z || !z.bereit || !z.start) return;
    const p = norm(e);
    const ziel = { x: z.original.x + p.x - z.start.x, y: z.original.y + p.y - z.start.y };
    // Ein sauberer Undo-Schritt: erst zurück auf den Ausgangswert, dann die eigentliche Änderung
    setzeVersatz(z.id, z.original);
    if (Math.abs(ziel.x - z.original.x) + Math.abs(ziel.y - z.original.y) < 1e-4) return;
    useProjekt.getState().aendere('Spieler verschieben', (d) => {
      const o = d.spielerObjekte.find((x) => x.id === z.id);
      if (o) o.versatz = ziel;
    });
  };

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none' }}
      data-testid="spielerkreuze"
    >
      {sichtbar.map((o) => {
        const kf = keyframeBei(o, zeit)?.kf;
        if (!kf) return null;
        const bx = spielerGeo(o, kf, quellZeitFuer(projekt, o.clipId, zeit)).box;
        const kannVerschieben = o.trackingModus !== 'auto';
        return (
          <div key={o.id}>
            <button
              type="button"
              data-testid="spieler-kreuz"
              aria-label={t.spieler.loeschen}
              title={t.spieler.loeschen}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                entferneSpieler(o.id);
              }}
              style={{
                ...KNOPF,
                cursor: 'pointer',
                left: `${(bx.x + bx.b) * 100}%`,
                top: `${bx.y * 100}%`,
                transform: 'translate(calc(-50% + 20px), calc(-50% - 20px))',
              }}
            >
              ×
            </button>
            {!kannVerschieben && (
              <button
                type="button"
                data-testid="spieler-hand-freeze"
                aria-label={t.spieler.handFreeze}
                title={t.spieler.handFreeze}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  wechsleModus(o.id, 'freeze', t.spieler.zuFreezeUmgestellt);
                }}
                style={{
                  ...KNOPF,
                  cursor: 'pointer',
                  borderStyle: 'dashed',
                  opacity: 0.85,
                  left: `${bx.x * 100}%`,
                  top: `${bx.y * 100}%`,
                  transform: 'translate(calc(-50% - 20px), calc(-50% - 20px))',
                }}
              >
                <HandSymbol />
              </button>
            )}
            {kannVerschieben && (
              <button
                type="button"
                data-testid="spieler-hand"
                aria-label={t.spieler.handVerschieben}
                title={t.spieler.handVerschieben}
                onPointerDown={(e) => handDown(e, o.id)}
                onPointerMove={handMove}
                onPointerUp={handUp}
                onPointerCancel={handUp}
                style={{
                  ...KNOPF,
                  cursor: 'grab',
                  touchAction: 'none',
                  left: `${bx.x * 100}%`,
                  top: `${bx.y * 100}%`,
                  transform: 'translate(calc(-50% - 20px), calc(-50% - 20px))',
                }}
              >
                <HandSymbol />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
