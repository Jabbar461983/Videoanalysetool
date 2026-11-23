import { useEffect } from 'react';
import { t } from '../i18n/de-CH';
import { holeAudio } from '../audio/modell';
import {
  oeffneMikrofon,
  schliesseMikrofon,
  starteAufnahme,
  stoppeAufnahme,
} from '../audio/aufnahmeSteuerung';
import { useAufnahme } from '../store/aufnahme';
import { useProjekt } from '../store/projektStore';
import s from './AufnahmeLeiste.module.css';

/** Aufnahme-Leiste direkt unter dem Video (nur im Clip-Editor): Mikrofon, Pegel, Spur, Aufnehmen/Stopp. */
export function AufnahmeLeiste({ clipId }: { clipId: string }) {
  const aufn = useAufnahme();
  const clip = useProjekt((x) => x.projekt?.clips.find((c) => c.id === clipId));
  useEffect(() => () => schliesseMikrofon(), []);
  if (!clip) return null;
  const spuren = holeAudio(clip).spuren;
  const bereit = aufn.phase === 'bereit';
  const aktiv = aufn.phase === 'laeuft' || aufn.phase === 'countdown';

  return (
    <div
      className={s.leiste}
      role="toolbar"
      aria-label={t.ton.aufnahme}
      data-testid="aufnahme-leiste"
    >
      <span className="kicker">{t.ton.aufnahme}</span>
      {aufn.phase === 'aus' ? (
        <button className="primaer" data-testid="mikro-an" onClick={() => void oeffneMikrofon()}>
          🎙 {t.ton.mikroAktivieren}
        </button>
      ) : (
        <>
          <select
            value={aufn.geraetId ?? ''}
            aria-label={t.ton.mikrofon}
            disabled={!bereit}
            onChange={(e) => void oeffneMikrofon(e.target.value)}
          >
            {aufn.geraete.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <div
            className={s.pegel}
            role="meter"
            aria-label={t.ton.pegel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(aufn.pegel * 100)}
            data-testid="pegel"
          >
            <div
              style={{
                width: `${Math.round(aufn.pegel * 100)}%`,
                background: aufn.pegel > 0.9 ? '#e53935' : 'var(--bd-green)',
              }}
            />
          </div>
          <select
            value={aufn.spurId ?? ''}
            aria-label={t.ton.zielSpur}
            disabled={!bereit}
            onChange={(e) => useAufnahme.getState().setze({ spurId: e.target.value || undefined })}
          >
            <option value="">{t.ton.zielAuto}</option>
            {spuren.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          {aktiv ? (
            <button
              className="gefahr"
              data-testid="aufnahme-stopp"
              onClick={() => void stoppeAufnahme()}
            >
              ■ {t.ton.stopp}
            </button>
          ) : (
            <button
              className="primaer"
              data-testid="aufnahme-start"
              disabled={!bereit}
              onClick={() => void starteAufnahme()}
            >
              ● {t.ton.aufnehmen}
            </button>
          )}
          {aufn.phase === 'countdown' && (
            <strong role="status" data-testid="countdown">
              {t.ton.countdown(aufn.countdown)}
            </strong>
          )}
          {aufn.phase === 'laeuft' && (
            <strong className={s.rec} role="status">
              {t.ton.laeuft}
            </strong>
          )}
          {aufn.phase === 'speichern' && <span role="status">{t.ton.speichert}</span>}
          <button disabled={!bereit} onClick={schliesseMikrofon}>
            {t.ton.mikroSchliessen}
          </button>
        </>
      )}
      {aufn.phase === 'aus' && <span className="hinweis">{t.ton.kopfhoerer}</span>}
      {aufn.fehler && (
        <span role="alert" style={{ color: '#ff8a80' }}>
          {aufn.fehler}
        </span>
      )}
    </div>
  );
}
