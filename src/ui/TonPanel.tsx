import { useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { holeAudio } from '../audio/modell';
import {
  aendereTon,
  segmentAendern,
  segmentLoeschen,
  spurHinzufuegen,
  spurLoeschen,
} from '../audio/aktionen';
import {
  oeffneMikrofon,
  schliesseMikrofon,
  starteAufnahme,
  stoppeAufnahme,
} from '../audio/aufnahmeSteuerung';
import { useAufnahme } from '../store/aufnahme';
import { useProjekt } from '../store/projektStore';
import s from './Seitenleiste.module.css';

const zahl = (x: string) => Number(x.replace(',', '.'));

/** Ton im Clip-Editor: Originalton, Ducking, Kommentarspuren, Mikrofon und Aufnahme. */
export function TonPanel({ clipId }: { clipId: string }) {
  const clip = useProjekt((x) => x.projekt?.clips.find((c) => c.id === clipId));
  const aufn = useAufnahme();
  const [ausgewaehlteSpur, setSpur] = useState<string | undefined>(undefined);
  useEffect(() => () => schliesseMikrofon(), []);
  useEffect(() => {
    useAufnahme.getState().setze({ spurId: ausgewaehlteSpur });
  }, [ausgewaehlteSpur]);
  if (!clip) return null;
  const a = holeAudio(clip);
  const bereit = aufn.phase === 'bereit';
  const laeuft = aufn.phase === 'laeuft';

  return (
    <section aria-label={t.ton.titel} data-testid="ton-panel">
      <p className="kicker">{t.ton.titel}</p>

      <div className={s.zeile} style={{ borderTop: 'none' }}>
        <strong style={{ color: 'var(--bd-ink)' }}>{t.ton.original}</strong>
        <div className={s.reihe}>
          <label className="hinweis">
            {t.ton.lautstaerke}{' '}
            <input
              type="range"
              min={0}
              max={150}
              value={Math.round(a.original.lautstaerke * 100)}
              aria-label={`${t.ton.original}: ${t.ton.lautstaerke}`}
              onChange={(e) =>
                aendereTon(
                  clipId,
                  'Originalton',
                  (x) => void (x.original.lautstaerke = Number(e.target.value) / 100),
                )
              }
            />
          </label>
          <label className="hinweis">
            <input
              type="checkbox"
              checked={a.original.stumm}
              data-testid="original-stumm"
              aria-label={`${t.ton.original}: ${t.ton.stumm}`}
              onChange={(e) =>
                aendereTon(clipId, 'Originalton', (x) => void (x.original.stumm = e.target.checked))
              }
            />{' '}
            {t.ton.stumm}
          </label>
          <label className="hinweis">
            <input
              type="checkbox"
              checked={a.original.solo}
              data-testid="original-solo"
              aria-label={`${t.ton.original}: ${t.ton.solo}`}
              onChange={(e) =>
                aendereTon(clipId, 'Originalton', (x) => void (x.original.solo = e.target.checked))
              }
            />{' '}
            {t.ton.solo}
          </label>
        </div>
        <div className={s.reihe}>
          <label className="hinweis">
            <input
              type="checkbox"
              checked={a.ducking.an}
              data-testid="ducking"
              aria-label={t.ton.ducking}
              onChange={(e) =>
                aendereTon(clipId, 'Ducking', (x) => void (x.ducking.an = e.target.checked))
              }
            />{' '}
            {t.ton.ducking}
          </label>
          <label className="hinweis">
            {t.ton.absenkung}{' '}
            <input
              type="range"
              min={-30}
              max={-3}
              value={a.ducking.absenkungDb}
              disabled={!a.ducking.an}
              aria-label={t.ton.absenkung}
              onChange={(e) =>
                aendereTon(
                  clipId,
                  'Ducking',
                  (x) => void (x.ducking.absenkungDb = Number(e.target.value)),
                )
              }
            />{' '}
            {a.ducking.absenkungDb} dB
          </label>
        </div>
      </div>

      <p className="kicker" style={{ marginTop: 12 }}>
        {t.ton.spuren}
      </p>
      {a.spuren.length === 0 && <p className="hinweis">{t.ton.keineSpuren}</p>}
      {a.spuren.map((sp) => (
        <div key={sp.id} className={s.zeile} data-testid="tonspur">
          <div className={s.reihe} style={{ margin: 0 }}>
            <input
              type="text"
              value={sp.name}
              aria-label={`${t.ton.spuren}: Name`}
              onChange={(e) =>
                aendereTon(clipId, 'Spurname', (x) => {
                  const z = x.spuren.find((y) => y.id === sp.id);
                  if (z) z.name = e.target.value;
                })
              }
              style={{ flex: 1, minWidth: 80 }}
            />
            <button
              className={`${s.mini} gefahr`}
              onClick={() => {
                if (window.confirm(t.ton.spurLoeschenFrage(sp.name))) spurLoeschen(clipId, sp.id);
              }}
            >
              {t.ton.spurLoeschen}
            </button>
          </div>
          <div className={s.reihe}>
            <label className="hinweis">
              {t.ton.lautstaerke}{' '}
              <input
                type="range"
                min={0}
                max={150}
                value={Math.round(sp.lautstaerke * 100)}
                aria-label={`${sp.name}: ${t.ton.lautstaerke}`}
                onChange={(e) =>
                  aendereTon(clipId, 'Spur-Lautstärke', (x) => {
                    const z = x.spuren.find((y) => y.id === sp.id);
                    if (z) z.lautstaerke = Number(e.target.value) / 100;
                  })
                }
              />
            </label>
            <label className="hinweis">
              <input
                type="checkbox"
                checked={sp.stumm}
                aria-label={`${sp.name}: ${t.ton.stumm}`}
                data-testid="spur-stumm"
                onChange={(e) =>
                  aendereTon(clipId, 'Spur stumm', (x) => {
                    const z = x.spuren.find((y) => y.id === sp.id);
                    if (z) z.stumm = e.target.checked;
                  })
                }
              />{' '}
              {t.ton.stumm}
            </label>
            <label className="hinweis">
              <input
                type="checkbox"
                checked={sp.solo}
                aria-label={`${sp.name}: ${t.ton.solo}`}
                data-testid="spur-solo"
                onChange={(e) =>
                  aendereTon(clipId, 'Spur solo', (x) => {
                    const z = x.spuren.find((y) => y.id === sp.id);
                    if (z) z.solo = e.target.checked;
                  })
                }
              />{' '}
              {t.ton.solo}
            </label>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={t.ton.segmente}>
            {sp.segmente.map((seg) => (
              <li key={seg.id} className={s.reihe} style={{ margin: 0 }} data-testid="segment">
                <label className="hinweis">
                  {t.ton.startLabel}{' '}
                  <input
                    type="text"
                    inputMode="decimal"
                    key={`s${seg.start}`}
                    defaultValue={seg.start}
                    aria-label={`${t.ton.startLabel} ${sp.name}`}
                    style={{ width: 56 }}
                    onBlur={(e) => {
                      const n = zahl(e.target.value);
                      if (n >= 0) void segmentAendern(clipId, seg.id, n, n + seg.dauer);
                      else e.target.value = String(seg.start);
                    }}
                  />
                </label>
                <label className="hinweis">
                  {t.ton.laengeLabel}{' '}
                  <input
                    type="text"
                    inputMode="decimal"
                    key={`d${seg.dauer}`}
                    defaultValue={seg.dauer}
                    aria-label={`${t.ton.laengeLabel} ${sp.name}`}
                    style={{ width: 56 }}
                    onBlur={(e) => {
                      const n = zahl(e.target.value);
                      if (n >= 0.1) void segmentAendern(clipId, seg.id, seg.start, seg.start + n);
                      else e.target.value = String(seg.dauer);
                    }}
                  />
                </label>
                <button
                  className={s.mini}
                  disabled={!bereit}
                  data-testid="neu-aufnehmen"
                  onClick={() => void starteAufnahme({ ersetzeSegId: seg.id })}
                >
                  {t.ton.neuAufnehmen}
                </button>
                <button
                  className={`${s.mini} gefahr`}
                  aria-label={t.ton.segmentLoeschen}
                  data-testid="segment-loeschen"
                  onClick={() => segmentLoeschen(clipId, seg.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className={s.reihe}>
        <button className={s.mini} onClick={() => setSpur(spurHinzufuegen(clipId))}>
          {t.ton.neueSpur}
        </button>
      </div>

      <p className="kicker" style={{ marginTop: 12 }}>
        {t.ton.aufnahme}
      </p>
      {aufn.phase === 'aus' ? (
        <button className="primaer" data-testid="mikro-an" onClick={() => void oeffneMikrofon()}>
          {t.ton.mikroAktivieren}
        </button>
      ) : (
        <div>
          <div className={s.reihe}>
            <label className="hinweis">
              {t.ton.mikrofon}{' '}
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
            </label>
            <button className={s.mini} disabled={!bereit} onClick={schliesseMikrofon}>
              {t.ton.mikroSchliessen}
            </button>
          </div>
          <div
            role="meter"
            aria-label={t.ton.pegel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(aufn.pegel * 100)}
            data-testid="pegel"
            style={{
              height: 10,
              background: 'var(--bd-surface)',
              border: '1px solid var(--bd-rule)',
              margin: '4px 0',
            }}
          >
            <div
              style={{
                width: `${Math.round(aufn.pegel * 100)}%`,
                height: '100%',
                background: aufn.pegel > 0.9 ? '#e53935' : 'var(--bd-green)',
              }}
            />
          </div>
          <div className={s.reihe}>
            <label className="hinweis">
              {t.ton.zielSpur}{' '}
              <select
                value={ausgewaehlteSpur ?? ''}
                aria-label={t.ton.zielSpur}
                onChange={(e) => setSpur(e.target.value || undefined)}
              >
                <option value="">{t.ton.zielAuto}</option>
                {a.spuren.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={s.reihe}>
            {laeuft || aufn.phase === 'countdown' ? (
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
            {laeuft && (
              <strong role="status" style={{ color: '#ff8a80' }}>
                {t.ton.laeuft}
              </strong>
            )}
            {aufn.phase === 'speichern' && <span role="status">{t.ton.speichert}</span>}
          </div>
          <p className="hinweis">{t.ton.kopfhoerer}</p>
        </div>
      )}
      {aufn.fehler && (
        <p className={s.fehler} role="alert">
          {aufn.fehler}
        </p>
      )}
    </section>
  );
}
