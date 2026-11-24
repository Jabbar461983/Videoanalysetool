import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { beendeKlickModus, klickInsVideo, starteKlickModus } from '../taktik/uebernehmenAktion';
import s from './ZeichenEbene.module.css';

/** Klick-Modus der Taktiktafel: jeder Klick auf die Füsse eines Spielers (oder den Ball) setzt einen Marker aufs Feld. */
export function TaktikKlickEbene() {
  const modus = useTaktik((x) => x.klickModus);
  const projekt = useProjekt((x) => x.projekt);
  if (!modus || !projekt) return null;
  return (
    <div
      className={`${s.ebene} ${s.zeichnen}`}
      style={{ zIndex: 9 }}
      data-testid="taktik-klickebene"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        klickInsVideo({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          right: 8,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--bd-scrim)',
          padding: 6,
          border: '1px solid var(--bd-gold)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 13 }}>{t.taktik.klickHinweis}</span>
        {(['team1', 'team2', 'ball'] as const).map((a) => (
          <button
            key={a}
            aria-pressed={modus === a}
            data-testid={`klick-${a}`}
            style={
              modus === a ? { borderColor: 'var(--bd-gold)', color: 'var(--bd-gold)' } : undefined
            }
            onClick={() => starteKlickModus(a)}
          >
            {a === 'team1'
              ? projekt.teams[0].kuerzel
              : a === 'team2'
                ? projekt.teams[1].kuerzel
                : t.taktik.wBall}
          </button>
        ))}
        <button className="primaer" data-testid="klick-fertig" onClick={beendeKlickModus}>
          {t.taktik.klickFertig}
        </button>
      </div>
    </div>
  );
}
