import { useState } from 'react';
import { t } from '../i18n/de-CH';
import { neueId } from '../model/schema';
import { spielstand, toreOhneTeam } from '../overlay/spielstand';
import { holeLogo } from '../render/logo';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { formatZeit } from '../video/bildmathe';
import { aktuelleQuellPosition } from '../wiedergabe/transport';
import s from './Seitenleiste.module.css';

const ganzzahl = (x: string): number | null => (/^\d{1,3}$/.test(x.trim()) ? Number(x) : null);

/** Setup: Logo/Spielstand ein-aus, Logo-Grösse, Startstand, manuelle Korrekturen. */
export function OverlayEinstellungen() {
  const projekt = useProjekt((x) => x.projekt);
  usePlayer((p) => p.zeit); // Anzeige «Stand jetzt» folgt der Position
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [fehler, setFehler] = useState('');
  if (!projekt) return null;
  const e = projekt.einstellungen;
  const pos = aktuelleQuellPosition();
  const jetzt = pos ? spielstand(projekt, pos.quelleId, pos.quellZeit) : null;
  const ohneTeam = toreOhneTeam(projekt);
  const logo = holeLogo();
  const einst = (name: string, fn: (x: typeof e) => void) =>
    useProjekt.getState().aendere(name, (p) => fn(p.einstellungen));

  const setzeKorrektur = () => {
    const na = ganzzahl(a === '' ? String(jetzt?.[0] ?? 0) : a);
    const nb = ganzzahl(b === '' ? String(jetzt?.[1] ?? 0) : b);
    if (na === null || nb === null || !pos) return setFehler(t.setup.nummerFehler);
    setFehler('');
    useProjekt.getState().aendere('Spielstand-Korrektur', (p) => {
      p.overlays.scoreKorrekturen.push({
        id: neueId(),
        quelleId: pos.quelleId,
        zeit: Math.round(pos.quellZeit * 100) / 100,
        stand: [na, nb],
      });
    });
    setA('');
    setB('');
  };

  return (
    <section aria-label={t.overlay.titel} data-testid="overlay-einstellungen">
      <p className="kicker">{t.overlay.titel}</p>
      <div className={s.reihe}>
        <label className="hinweis">
          <input
            type="checkbox"
            checked={e.logoAnzeigen}
            data-testid="logo-global"
            onChange={(ev) => einst('Logo', (x) => void (x.logoAnzeigen = ev.target.checked))}
          />{' '}
          {t.overlay.logoAnzeigen}
        </label>
        <label className="hinweis">
          <input
            type="checkbox"
            checked={e.scoreboardAnzeigen}
            data-testid="score-global"
            onChange={(ev) =>
              einst('Spielstand', (x) => void (x.scoreboardAnzeigen = ev.target.checked))
            }
          />{' '}
          {t.overlay.scoreboardAnzeigen}
        </label>
      </div>
      <label className="hinweis">
        {t.overlay.logoGroesse}: {e.logoGroesse} %
        <input
          type="range"
          min={4}
          max={25}
          value={e.logoGroesse}
          aria-label={t.overlay.logoGroesse}
          onChange={(ev) =>
            einst('Logo-Grösse', (x) => void (x.logoGroesse = Number(ev.target.value)))
          }
          style={{ width: '100%' }}
        />
      </label>
      {logo?.platzhalter && <p className="hinweis">{t.overlay.platzhalter}</p>}

      <p className="kicker" style={{ marginTop: 12 }}>
        {t.overlay.startstand}
      </p>
      <div className={s.reihe}>
        {([0, 1] as const).map((i) => (
          <label key={i} className="hinweis">
            {projekt.teams[i].kuerzel}{' '}
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${t.overlay.startstand} ${projekt.teams[i].kuerzel}`}
              key={e.startstand[i]}
              defaultValue={e.startstand[i]}
              style={{ width: 52 }}
              onBlur={(ev) => {
                const n = ganzzahl(ev.target.value);
                if (n === null) ev.target.value = String(e.startstand[i]);
                else einst('Startstand', (x) => void (x.startstand[i] = n));
              }}
            />
          </label>
        ))}
      </div>
      {jetzt && (
        <p className="hinweis" data-testid="stand-jetzt" role="status">
          {t.overlay.standJetzt(jetzt[0], jetzt[1])}
        </p>
      )}
      {ohneTeam > 0 && <p className={s.fehler}>{t.overlay.toreOhneTeam(ohneTeam)}</p>}

      <p className="kicker" style={{ marginTop: 12 }}>
        {t.overlay.korrekturen}
      </p>
      <p className="hinweis">{t.overlay.korrekturHinweis}</p>
      <div className={s.reihe}>
        <input
          type="text"
          inputMode="numeric"
          placeholder={projekt.teams[0].kuerzel}
          aria-label={`${t.overlay.korrekturen} ${projekt.teams[0].kuerzel}`}
          value={a}
          onChange={(ev) => setA(ev.target.value)}
          style={{ width: 52 }}
        />
        <span>:</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder={projekt.teams[1].kuerzel}
          aria-label={`${t.overlay.korrekturen} ${projekt.teams[1].kuerzel}`}
          value={b}
          onChange={(ev) => setB(ev.target.value)}
          style={{ width: 52 }}
        />
        <button className="primaer" data-testid="korrektur-setzen" onClick={setzeKorrektur}>
          {t.overlay.korrekturSetzen}
        </button>
      </div>
      {fehler && (
        <p className={s.fehler} role="alert">
          {fehler}
        </p>
      )}
      {projekt.overlays.scoreKorrekturen.length === 0 && (
        <p className="hinweis">{t.overlay.korrekturKeine}</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="korrekturen">
        {[...projekt.overlays.scoreKorrekturen]
          .sort(
            (x, y) =>
              projekt.quellen.findIndex((q) => q.id === x.quelleId) -
                projekt.quellen.findIndex((q) => q.id === y.quelleId) || x.zeit - y.zeit,
          )
          .map((k) => {
            const q = projekt.quellen.find((x) => x.id === k.quelleId);
            return (
              <li
                key={k.id}
                className={s.reihe}
                style={{ margin: 0, borderTop: '1px solid var(--bd-rule)' }}
              >
                <span className="hinweis" style={{ flex: 1 }}>
                  {q?.dateiname ?? '?'} · {formatZeit(k.zeit, q?.fps ?? 25)} →{' '}
                  <strong style={{ color: 'var(--bd-gold)' }}>
                    {k.stand[0]} : {k.stand[1]}
                  </strong>
                </span>
                <button
                  className={s.mini}
                  aria-label={`${t.overlay.entfernen}: ${k.stand[0]} : ${k.stand[1]}`}
                  onClick={() =>
                    useProjekt.getState().aendere('Korrektur entfernen', (p) => {
                      p.overlays.scoreKorrekturen = p.overlays.scoreKorrekturen.filter(
                        (x) => x.id !== k.id,
                      );
                    })
                  }
                >
                  ✕
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
