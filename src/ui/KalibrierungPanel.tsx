import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import {
  beendeKlickModus,
  starteKlickModus,
  uebernimmAlleSpieler,
} from '../taktik/uebernehmenAktion';
import { bewerteKalibrierung } from '../taktik/homographie';
import { aktuelleQuellPosition } from '../wiedergabe/transport';
import s from './Seitenleiste.module.css';

/** Kalibrierungen der Kamera-Einstellungen und «Situation übernehmen» (Erkennung oder Klick). */
export function KalibrierungPanel() {
  const projekt = useProjekt((x) => x.projekt);
  const meldung = useTaktik((x) => x.meldung);
  const beschaeftigt = useTaktik((x) => x.beschaeftigt);
  const klickModus = useTaktik((x) => x.klickModus);
  if (!projekt) return null;
  const { kalibrierungen, aktiveKalibrierung, feld } = projekt.taktik;
  const diag = Math.hypot(feld.laenge, feld.breite);
  const pos = aktuelleQuellPosition();
  const quelleId = pos?.quelleId ?? projekt.aktiveQuelleId ?? projekt.quellen[0]?.id;
  const liste = kalibrierungen.filter((k) => k.quelleId === quelleId);

  return (
    <section aria-label={t.taktik.kalibrierung} data-testid="kalibrierung-panel">
      <p className="kicker">{t.taktik.kalibrierung}</p>
      <p className="hinweis">{t.taktik.kalibrierErklaerung}</p>
      <button
        data-testid="neu-kalibrieren"
        onClick={() => useTaktik.getState().setze({ kalibrierungOffen: true })}
        disabled={!quelleId}
      >
        {t.taktik.neuKalibrieren}
      </button>
      <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0' }} data-testid="kalibrierungen">
        {liste.map((k) => {
          const aktiv = (aktiveKalibrierung[k.quelleId] ?? liste[liste.length - 1]?.id) === k.id;
          const g = bewerteKalibrierung({ H: k.H, rms: k.rms, maxFehler: null }, diag);
          return (
            <li
              key={k.id}
              className={`${s.zeile} ${aktiv ? s.aktiv : ''}`}
              style={{ display: 'flex', gap: 4, alignItems: 'center' }}
            >
              <button
                className={s.klick}
                onClick={() =>
                  useProjekt.getState().aendereStill((p) => {
                    p.taktik.aktiveKalibrierung[k.quelleId] = k.id;
                  })
                }
              >
                <strong style={{ color: 'var(--bd-ink)' }}>{k.name}</strong>
                <span className="hinweis">
                  {g === 'ungeprueft'
                    ? t.taktik.guete4Kurz
                    : `${k.rms!.toFixed(2)} m · ${t.taktik.gueteStufen[g]}`}
                </span>
              </button>
              <button
                aria-label={`${t.taktik.loeschen}: ${k.name}`}
                onClick={() =>
                  useProjekt.getState().aendere('Kalibrierung löschen', (p) => {
                    p.taktik.kalibrierungen = p.taktik.kalibrierungen.filter((x) => x.id !== k.id);
                    if (p.taktik.aktiveKalibrierung[k.quelleId] === k.id)
                      delete p.taktik.aktiveKalibrierung[k.quelleId];
                  })
                }
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <div style={{ height: 8 }} />
      <p className="kicker">{t.taktik.uebernehmen}</p>
      <p className="hinweis">{t.taktik.uebernehmenErklaerung}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className="primaer"
          disabled={beschaeftigt || !!klickModus}
          data-testid="uebernehmen-auto"
          onClick={() => void uebernimmAlleSpieler()}
        >
          {beschaeftigt ? t.taktik.erkenneLaeuft : t.taktik.uebernehmenAuto}
        </button>
        {!klickModus ? (
          <button
            disabled={beschaeftigt}
            data-testid="uebernehmen-klick"
            onClick={() => starteKlickModus('team1')}
          >
            {t.taktik.uebernehmenKlick}
          </button>
        ) : (
          <button onClick={beendeKlickModus}>{t.taktik.klickFertig}</button>
        )}
      </div>
      {meldung && (
        <p
          role="status"
          className="hinweis"
          data-testid="taktik-meldung"
          style={{ color: 'var(--bd-gold)' }}
        >
          {meldung}
        </p>
      )}
    </section>
  );
}
