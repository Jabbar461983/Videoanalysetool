import { useMemo } from 'react';
import { t } from '../i18n/de-CH';
import {
  aendereSpieler,
  entferneSpieler,
  sichereHintergrund,
  waehleSpieler,
} from '../ki/spielerAktionen';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useSpielerKi } from '../store/spielerKi';
import { PALETTE } from '../zeichnen/geometrie';
import s from './Seitenleiste.module.css';

/** Markierte Spieler des Clips: Liste, Effekte, Farbe, Beschriftung, Verschieben. */
export function SpielerPanel({ clipId }: { clipId: string }) {
  const alle = useProjekt((x) => x.projekt?.spielerObjekte);
  const teams = useProjekt((x) => x.projekt?.teams);
  const liste = useMemo(() => alle?.filter((o) => o.clipId === clipId) ?? [], [alle, clipId]);
  const auswahlId = useSpielerKi((x) => x.auswahlId);
  const verschieben = useSpielerKi((x) => x.verschieben);
  const status = useSpielerKi((x) => x.status);
  const o = liste.find((x) => x.id === auswahlId);
  const verschoben = !!o && Math.abs(o.versatz.x) + Math.abs(o.versatz.y) > 1e-6;

  return (
    <section aria-label={t.spieler.titel} data-testid="spieler-panel">
      <p className="kicker">
        {t.spieler.titel} · <span className="hinweis">{liste.length}</span>
      </p>
      {liste.length === 0 && <p className="hinweis">{t.spieler.leer}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="spielerliste">
        {liste.map((x, i) => (
          <li key={x.id} className={`${s.zeile} ${x.id === auswahlId ? s.aktiv : ''}`}>
            <button
              className={s.klick}
              onClick={() => {
                waehleSpieler(x.id === auswahlId ? null : x.id);
                usePlayer.getState().suche(x.start + 0.01);
              }}
            >
              <span
                className={s.punkt}
                style={{ background: x.farbe, border: '1px solid var(--bd-rule)' }}
              />
              <strong style={{ color: 'var(--bd-ink)' }}>
                {x.effekte.text || t.spieler.objekt(i + 1)}
              </strong>
              <span className="hinweis">
                {x.start.toFixed(1)}–{x.ende.toFixed(1)} s
              </span>
            </button>
          </li>
        ))}
      </ul>
      {o && (
        <div data-testid="spieler-eigenschaften" style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {(
            [
              ['spotlight', t.spieler.spotlight],
              ['ring', t.spieler.ring],
              ['kontur', t.spieler.kontur],
              ['lupe', t.spieler.lupe],
              ['label', t.spieler.label],
            ] as const
          ).map(([k, name]) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={o.effekte[k]}
                data-testid={`effekt-${k}`}
                onChange={(e) =>
                  aendereSpieler('Spieler-Effekt', o.id, (z) => {
                    z.effekte[k] = e.target.checked;
                  })
                }
              />{' '}
              {name}
            </label>
          ))}
          {o.effekte.spotlight && (
            <label>
              {t.spieler.staerke}{' '}
              <input
                type="range"
                min={20}
                max={95}
                value={Math.round(o.effekte.spotlightStaerke * 100)}
                aria-label={t.spieler.staerke}
                onChange={(e) =>
                  aendereSpieler('Spotlight-Stärke', o.id, (z) => {
                    z.effekte.spotlightStaerke = Number(e.target.value) / 100;
                  })
                }
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span className="hinweis">{t.spieler.farbe}</span>
            {PALETTE.map((f) => (
              <button
                key={f.wert}
                style={{
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  minHeight: 28,
                  padding: 0,
                  background: f.wert,
                  border:
                    o.farbe.toLowerCase() === f.wert.toLowerCase()
                      ? '2px solid var(--bd-gold)'
                      : '2px solid var(--bd-rule)',
                }}
                aria-label={`${t.spieler.farbe}: ${f.name}`}
                onClick={() => aendereSpieler('Spielerfarbe', o.id, (z) => void (z.farbe = f.wert))}
              />
            ))}
          </div>
          <label>
            {t.spieler.labelText}
            <input
              type="text"
              value={o.effekte.text}
              data-testid="spieler-text"
              onChange={(e) =>
                aendereSpieler('Spielerbeschriftung', o.id, (z) => {
                  z.effekte.text = e.target.value;
                  if (e.target.value) z.effekte.label = true;
                })
              }
            />
          </label>
          <select
            aria-label={t.spieler.ausKader}
            value=""
            onChange={(e) => {
              const [tid, sid] = e.target.value.split('|');
              const sp = teams?.find((x) => x.id === tid)?.kader.find((x) => x.id === sid);
              if (sp)
                aendereSpieler('Spielerbeschriftung', o.id, (z) => {
                  z.effekte.text = `#${sp.nummer} ${sp.name}`.trim();
                  z.effekte.label = true;
                });
            }}
          >
            <option value="">{t.spieler.ausKader}</option>
            {teams?.flatMap((tm) =>
              tm.kader.map((sp) => (
                <option key={sp.id} value={`${tm.id}|${sp.id}`}>
                  {tm.kuerzel} #{sp.nummer} {sp.name}
                </option>
              )),
            )}
          </select>
          <label>
            <input
              type="checkbox"
              checked={verschieben}
              data-testid="spieler-verschieben"
              disabled={status === 'fuellt'}
              onChange={(e) => {
                useSpielerKi.getState().setze({ verschieben: e.target.checked });
                if (e.target.checked) void sichereHintergrund(o.id);
              }}
            />{' '}
            {t.spieler.verschieben}
          </label>
          <label>
            <input
              type="checkbox"
              checked={o.pfeil}
              onChange={(e) =>
                aendereSpieler('Spielerpfeil', o.id, (z) => void (z.pfeil = e.target.checked))
              }
            />{' '}
            {t.spieler.pfeil}
          </label>
          {verschoben && (
            <button
              onClick={() =>
                aendereSpieler(
                  'Spieler zurücksetzen',
                  o.id,
                  (z) => void (z.versatz = { x: 0, y: 0 }),
                )
              }
            >
              {t.spieler.zuruecksetzen}
            </button>
          )}
          <button
            className="gefahr"
            data-testid="spieler-loeschen"
            onClick={() => entferneSpieler(o.id)}
          >
            {t.spieler.loeschen}
          </button>
        </div>
      )}
    </section>
  );
}
