import { t } from '../i18n/de-CH';
import { entferneSpieler } from '../ki/spielerAktionen';
import { istSpielerSichtbar, keyframeBei } from '../render/spieler';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useProgramm } from '../store/programm';

/** Kleines ✕ am Kopf jedes sichtbaren, freigestellten Spielers: entfernt die Markierung. */
export function SpielerKreuze() {
  const objekte = useProjekt((x) => x.projekt?.spielerObjekte);
  const clipId = useProgramm((x) => (x.art === 'clip' ? x.clipId : undefined));
  const zeit = usePlayer((x) => x.zeit);
  if (!objekte || !clipId) return null;
  const sichtbar = objekte.filter((o) => o.clipId === clipId && istSpielerSichtbar(o, zeit));
  if (sichtbar.length === 0) return null;
  return (
    <div
      aria-hidden={false}
      style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none' }}
      data-testid="spielerkreuze"
    >
      {sichtbar.map((o) => {
        const kf = keyframeBei(o, zeit)?.kf;
        if (!kf) return null;
        const x = (kf.box.x + kf.box.b + o.versatz.x) * 100;
        const y = (kf.box.y + o.versatz.y) * 100;
        return (
          <button
            key={o.id}
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
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              width: 26,
              height: 26,
              minWidth: 26,
              minHeight: 26,
              padding: 0,
              lineHeight: 1,
              fontSize: 16,
              fontWeight: 700,
              background: 'var(--bd-surface)',
              color: '#fff',
              border: '1px solid var(--bd-gold)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        );
      })}
    </div>
  );
}
