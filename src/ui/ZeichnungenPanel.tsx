import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { VorlageRow } from '../db/db';
import { listeVorlagen, speichereVorlage } from '../db/vorlagen';
import { neueId } from '../model/schema';
import type { Zeichnung } from '../model/typen';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useZeichnen } from '../store/zeichnen';
import { aktuellerPlan } from '../wiedergabe/transport';
import { WERKZEUG_NAMEN } from '../zeichnen/geometrie';
import { standardZeitspanne } from '../zeichnen/logik';
import {
  aendereAuswahl,
  ebeneAendern,
  fuegeAusZwischenablageEin,
  fuegeZeichnungHinzu,
  kopiereAuswahl,
  loescheAuswahl,
  schalteGebogenAuswahl,
} from '../zeichnen/aktionen';
import s from './Seitenleiste.module.css';

type Favorit = Pick<Zeichnung, 'werkzeug' | 'punkte' | 'stil' | 'animation' | 'text' | 'nummer'> & {
  dauer: number;
};

const zahl = (x: string) => Number(x.replace(',', '.'));

/** Zeichnungen des Clips: Liste, Eigenschaften der Auswahl, Ebenen, Kopieren/Einfügen, Favoriten. */
export function ZeichnungenPanel({ clipId }: { clipId: string }) {
  const alle = useProjekt((x) => x.projekt?.zeichnungen);
  const liste = useMemo(() => alle?.filter((z) => z.clipId === clipId), [alle, clipId]);
  const auswahlId = useZeichnen((z) => z.auswahlId);
  const zwischen = useZeichnen((z) => z.zwischenablage);
  const [favoriten, setFavoriten] = useState<VorlageRow[]>([]);
  const [meldung, setMeldung] = useState('');
  const ladeFav = useCallback(async () => setFavoriten(await listeVorlagen('zeichnung')), []);
  useEffect(() => {
    void ladeFav();
  }, [ladeFav]);
  const z = liste?.find((x) => x.id === auswahlId);

  const speichereFavorit = async () => {
    if (!z) return;
    const name = window.prompt(t.zeichnen.favoritName, WERKZEUG_NAMEN[z.werkzeug])?.trim();
    if (!name) return;
    const daten: Favorit = JSON.parse(
      JSON.stringify({
        werkzeug: z.werkzeug,
        punkte: z.punkte,
        stil: z.stil,
        animation: z.animation,
        text: z.text,
        nummer: z.nummer,
        dauer: z.ende - z.start,
      }),
    );
    await speichereVorlage('zeichnung', name, daten);
    setMeldung(t.zeichnen.favoritGespeichert);
    await ladeFav();
  };
  const fuegeFavoritEin = (row: VorlageRow) => {
    const f = row.daten as Favorit;
    const plan = aktuellerPlan();
    const zeit = standardZeitspanne(plan?.segmente ?? [], usePlayer.getState().zeit, f.dauer);
    fuegeZeichnungHinzu({
      ...JSON.parse(JSON.stringify(f)),
      id: neueId(),
      clipId,
      start: zeit.start,
      ende: zeit.ende,
    });
  };

  return (
    <section aria-label={t.zeichnen.liste} data-testid="zeichnungen-panel">
      <p className="kicker">
        {t.zeichnen.liste} · <span className="hinweis">{liste?.length ?? 0}</span>
      </p>
      {(liste?.length ?? 0) === 0 && <p className="hinweis">{t.zeichnen.leer}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="zeichnungsliste">
        {liste?.map((x) => (
          <li key={x.id} className={`${s.zeile} ${x.id === auswahlId ? s.aktiv : ''}`}>
            <button
              className={s.klick}
              onClick={() => {
                useZeichnen.getState().waehle(x.id === auswahlId ? null : x.id);
                usePlayer.getState().suche(x.start + 0.01);
              }}
            >
              <span
                className={s.punkt}
                style={{ background: x.stil.farbe, border: '1px solid var(--bd-rule)' }}
              />
              <strong style={{ color: 'var(--bd-ink)' }}>{WERKZEUG_NAMEN[x.werkzeug]}</strong>
              {x.text && <span className="hinweis">«{x.text}»</span>}
              <span className="hinweis">
                {x.start.toFixed(1)}–{x.ende.toFixed(1)} s
              </span>
            </button>
          </li>
        ))}
      </ul>

      {z && (
        <div data-testid="zeichnung-eigenschaften">
          <div className={s.raster}>
            <label>
              {t.zeichnen.start}
              <input
                type="text"
                inputMode="decimal"
                aria-label={t.zeichnen.start}
                key={`s${z.start}`}
                defaultValue={z.start}
                onBlur={(e) => {
                  const n = zahl(e.target.value);
                  if (n >= 0 && n < z.ende - 0.1)
                    aendereAuswahl('Zeitspanne', (d) => void (d.start = n));
                  else e.target.value = String(z.start);
                }}
              />
            </label>
            <label>
              {t.zeichnen.ende}
              <input
                type="text"
                inputMode="decimal"
                aria-label={t.zeichnen.ende}
                key={`e${z.ende}`}
                defaultValue={z.ende}
                onBlur={(e) => {
                  const n = zahl(e.target.value);
                  const max = aktuellerPlan()?.dauer ?? Infinity;
                  if (n > z.start + 0.1 && n <= max + 1e-6)
                    aendereAuswahl('Zeitspanne', (d) => void (d.ende = n));
                  else e.target.value = String(z.ende);
                }}
              />
            </label>
            <label>
              {t.zeichnen.einAnim}
              <select
                aria-label={t.zeichnen.einAnim}
                value={z.animation.ein}
                onChange={(e) =>
                  aendereAuswahl(
                    'Animation',
                    (d) => void (d.animation.ein = e.target.value as Zeichnung['animation']['ein']),
                  )
                }
              >
                {(['keine', 'einblenden', 'zeichnen'] as const)
                  .filter(
                    (a) =>
                      a !== 'zeichnen' ||
                      ['pfeil', 'linie', 'freihand', 'kreis'].includes(z.werkzeug),
                  )
                  .map((a) => (
                    <option key={a} value={a}>
                      {t.zeichnen.animEin[a]}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t.zeichnen.dauer}
              <input
                type="text"
                inputMode="decimal"
                aria-label={`${t.zeichnen.einAnim}: ${t.zeichnen.dauer}`}
                key={`de${z.animation.dauerEin}`}
                defaultValue={z.animation.dauerEin}
                onBlur={(e) => {
                  const n = zahl(e.target.value);
                  if (n >= 0 && n <= 20)
                    aendereAuswahl('Animation', (d) => void (d.animation.dauerEin = n));
                  else e.target.value = String(z.animation.dauerEin);
                }}
              />
            </label>
            <label>
              {t.zeichnen.ausAnim}
              <select
                aria-label={t.zeichnen.ausAnim}
                value={z.animation.aus}
                onChange={(e) =>
                  aendereAuswahl(
                    'Animation',
                    (d) => void (d.animation.aus = e.target.value as Zeichnung['animation']['aus']),
                  )
                }
              >
                {(['keine', 'ausblenden'] as const).map((a) => (
                  <option key={a} value={a}>
                    {t.zeichnen.animAus[a]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.zeichnen.dauer}
              <input
                type="text"
                inputMode="decimal"
                aria-label={`${t.zeichnen.ausAnim}: ${t.zeichnen.dauer}`}
                key={`da${z.animation.dauerAus}`}
                defaultValue={z.animation.dauerAus}
                onBlur={(e) => {
                  const n = zahl(e.target.value);
                  if (n >= 0 && n <= 20)
                    aendereAuswahl('Animation', (d) => void (d.animation.dauerAus = n));
                  else e.target.value = String(z.animation.dauerAus);
                }}
              />
            </label>
            {z.werkzeug === 'text' && (
              <label style={{ gridColumn: '1 / -1' }}>
                {t.zeichnen.textLabel}
                <input
                  type="text"
                  value={z.text ?? ''}
                  aria-label={t.zeichnen.textLabel}
                  onChange={(e) => aendereAuswahl('Text', (d) => void (d.text = e.target.value))}
                />
              </label>
            )}
            {z.werkzeug === 'marker' && (
              <label>
                {t.zeichnen.nummer}
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t.zeichnen.nummer}
                  key={`n${z.nummer}`}
                  defaultValue={z.nummer}
                  onBlur={(e) => {
                    const n = Math.round(zahl(e.target.value));
                    if (n >= 0 && n <= 99) aendereAuswahl('Nummer', (d) => void (d.nummer = n));
                    else e.target.value = String(z.nummer ?? '');
                  }}
                />
              </label>
            )}
          </div>
          <div className={s.reihe}>
            {(z.werkzeug === 'pfeil' || z.werkzeug === 'linie') && (
              <button
                className={s.mini}
                data-testid="biegen"
                onClick={() => schalteGebogenAuswahl(1920, 1080)}
              >
                {t.zeichnen.biegen}
              </button>
            )}
            <button className={s.mini} onClick={() => ebeneAendern('vorn')}>
              {t.zeichnen.nachVorn}
            </button>
            <button
              className={s.mini}
              aria-label={t.zeichnen.hoeher}
              onClick={() => ebeneAendern('hoeher')}
            >
              ↑
            </button>
            <button
              className={s.mini}
              aria-label={t.zeichnen.tiefer}
              onClick={() => ebeneAendern('tiefer')}
            >
              ↓
            </button>
            <button className={s.mini} onClick={() => ebeneAendern('hinten')}>
              {t.zeichnen.nachHinten}
            </button>
          </div>
          <div className={s.reihe}>
            <button className={s.mini} onClick={kopiereAuswahl}>
              {t.zeichnen.kopieren}
            </button>
            <button
              className={`${s.mini} gefahr`}
              data-testid="zeichnung-loeschen"
              onClick={loescheAuswahl}
            >
              {t.zeichnen.loeschen}
            </button>
            <button className={s.mini} onClick={() => void speichereFavorit()}>
              {t.zeichnen.favorit}
            </button>
          </div>
        </div>
      )}
      <div className={s.reihe}>
        <button className={s.mini} disabled={!zwischen} onClick={fuegeAusZwischenablageEin}>
          {t.zeichnen.einfuegen}
        </button>
        {favoriten.length > 0 && (
          <select
            aria-label={t.zeichnen.favoriten}
            value=""
            onChange={(e) => {
              const row = favoriten.find((f) => f.id === e.target.value);
              if (row) fuegeFavoritEin(row);
            }}
          >
            <option value="">{t.zeichnen.favoritEinfuegen}</option>
            {favoriten.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {meldung && (
        <p className="hinweis" role="status">
          {meldung}
        </p>
      )}
    </section>
  );
}
