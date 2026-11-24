import { t } from '../i18n/de-CH';
import type { FeldMasse, TafelAnzeige } from '../model/typen';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { schalteTafel, sichereSituation } from '../taktik/aktionen';
import { bereinigeFeld } from '../taktik/feld';
import {
  dupliziereSituation,
  entferneAbschnitt,
  neueSituation,
  STANDARD_ANZEIGE,
} from '../taktik/logik';
import { KalibrierungPanel } from './KalibrierungPanel';
import s from './Seitenleiste.module.css';

const FELD_FELDER: [keyof FeldMasse, string][] = [
  ['laenge', t.taktik.laenge],
  ['breite', t.taktik.breite],
  ['eckenradius', t.taktik.eckenradius],
  ['torLinieAbstand', t.taktik.torLinieAbstand],
  ['torBreite', t.taktik.torBreite],
  ['torTiefe', t.taktik.torTiefe],
  ['torraumBreite', t.taktik.torraumBreite],
  ['torraumTiefe', t.taktik.torraumTiefe],
  ['bullyX', t.taktik.bullyX],
  ['bullyY', t.taktik.bullyY],
  ['mittelkreisRadius', t.taktik.mittelkreis],
];

/** Reiter «Taktik»: Situationen, Anzeige im Clip, Kalibrierung, Feldmasse. */
export function TaktikPanel() {
  const projekt = useProjekt((x) => x.projekt);
  const art = useProgramm((g) => g.art);
  const clipId = useProgramm((g) => g.clipId);
  const sitId = useTaktik((x) => x.situationId);
  if (!projekt) return null;
  const { feld, situationen } = projekt.taktik;
  const clip = art === 'clip' ? projekt.clips.find((c) => c.id === clipId) : undefined;
  const anzeige: TafelAnzeige = clip?.taktik?.anzeige ?? STANDARD_ANZEIGE;
  const setzeAnzeige = (patch: Partial<TafelAnzeige>) =>
    useProjekt.getState().aendere('Tafel-Anzeige', (p) => {
      const c = p.clips.find((x) => x.id === clipId);
      if (!c) return;
      c.taktik ??= { anzeige: { ...STANDARD_ANZEIGE }, abschnitte: [] };
      Object.assign(c.taktik.anzeige, patch);
    });
  const setzeFeld = (patch: Partial<FeldMasse>) =>
    useProjekt.getState().aendere('Feldmasse', (p) => {
      p.taktik.feld = bereinigeFeld({ ...p.taktik.feld, ...patch });
    });
  const sitName = (id?: string) => situationen.find((x) => x.id === id)?.name ?? '–';

  return (
    <section aria-label={t.taktik.titel} data-testid="taktik-panel">
      <p className="kicker">{t.taktik.situationen}</p>
      {!feld.geprueft && (
        <p
          className="hinweis"
          role="note"
          data-testid="feld-platzhalter"
          style={{ color: 'var(--bd-gold)' }}
        >
          {t.taktik.feldPlatzhalter}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
        <button
          className="primaer"
          data-testid="neue-situation"
          onClick={() => {
            const n = neueSituation(`Situation ${situationen.length + 1}`);
            useProjekt
              .getState()
              .aendere('Neue Situation', (p) => void p.taktik.situationen.push(n));
            useTaktik.getState().setze({ situationId: n.id, markerId: null, editorOffen: true });
          }}
        >
          {t.taktik.neueSituation}
        </button>
        <button
          data-testid="tafel-oeffnen"
          onClick={() => {
            sichereSituation();
            useTaktik.getState().setze({ editorOffen: true });
          }}
        >
          {t.taktik.bearbeiten}
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="situationsliste">
        {situationen.map((sit) => (
          <li
            key={sit.id}
            className={`${s.zeile} ${sit.id === sitId ? s.aktiv : ''}`}
            style={{ display: 'flex', gap: 4, alignItems: 'center' }}
          >
            <button
              className={s.klick}
              onClick={() =>
                useTaktik
                  .getState()
                  .setze({ situationId: sit.id, markerId: null, editorOffen: true })
              }
            >
              <strong style={{ color: 'var(--bd-ink)' }}>{sit.name}</strong>
              <span className="hinweis">
                {sit.marker.length} Marker, {sit.pfeile.length} Pfeile
              </span>
            </button>
            <button
              aria-label={`${t.taktik.duplizieren}: ${sit.name}`}
              onClick={() => {
                const k = dupliziereSituation(sit);
                useProjekt
                  .getState()
                  .aendere('Situation duplizieren', (p) => void p.taktik.situationen.push(k));
              }}
            >
              ⧉
            </button>
            <button
              aria-label={`${t.taktik.loeschen}: ${sit.name}`}
              onClick={() => {
                if (!window.confirm(`«${sit.name}» löschen?`)) return;
                useProjekt.getState().aendere('Situation löschen', (p) => {
                  p.taktik.situationen = p.taktik.situationen.filter((x) => x.id !== sit.id);
                  // Abschnitte, die darauf zeigen, zeigen danach eine leere Tafel
                  for (const c of p.clips)
                    for (const a of c.taktik?.abschnitte ?? []) {
                      if (a.situationId === sit.id) delete a.situationId;
                      if (a.nachSituationId === sit.id) delete a.nachSituationId;
                    }
                });
                if (sitId === sit.id) useTaktik.getState().setze({ situationId: null });
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div style={{ height: 16 }} />
      <p className="kicker">{t.taktik.anzeige}</p>
      {!clip ? (
        <p className="hinweis">{t.taktik.nurImClip}</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }} data-testid="taktik-anzeige">
          <label>
            {t.taktik.modus}{' '}
            <select
              value={anzeige.modus}
              data-testid="tafel-modus"
              onChange={(e) => setzeAnzeige({ modus: e.target.value as TafelAnzeige['modus'] })}
            >
              {(['pip', 'geteilt', 'voll'] as const).map((m) => (
                <option key={m} value={m}>
                  {t.taktik.modi[m]}
                </option>
              ))}
            </select>
          </label>
          {anzeige.modus === 'pip' && (
            <>
              <label>
                {t.taktik.ecke}{' '}
                <select
                  value={anzeige.ecke}
                  data-testid="tafel-ecke"
                  onChange={(e) => setzeAnzeige({ ecke: e.target.value as TafelAnzeige['ecke'] })}
                >
                  {(['ol', 'or', 'ul', 'ur'] as const).map((e2) => (
                    <option key={e2} value={e2}>
                      {t.taktik.ecken[e2]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.taktik.groesse}{' '}
                <input
                  type="range"
                  min={15}
                  max={60}
                  value={Math.round(anzeige.groesse * 100)}
                  aria-label={t.taktik.groesse}
                  onChange={(e) => setzeAnzeige({ groesse: Number(e.target.value) / 100 })}
                />
              </label>
            </>
          )}
          <button className="primaer" data-testid="tafel-einblenden" onClick={() => schalteTafel()}>
            {t.taktik.einblenden}
          </button>
          <p className="hinweis">{t.taktik.abschnitte}</p>
          {(clip.taktik?.abschnitte.length ?? 0) === 0 && (
            <p className="hinweis">{t.taktik.keineAbschnitte}</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="tafel-abschnitte">
            {clip.taktik?.abschnitte.map((a) => (
              <li key={a.id} className={s.zeile} style={{ display: 'grid', gap: 4 }}>
                <span className="hinweis">
                  {a.start.toFixed(1)}–{a.ende.toFixed(1)} s · {sitName(a.situationId)}
                  {a.nachSituationId ? ` → ${sitName(a.nachSituationId)}` : ''}
                </span>
                <select
                  aria-label={t.taktik.situation}
                  value={a.situationId ?? ''}
                  onChange={(e) =>
                    useProjekt.getState().aendere('Tafel-Situation', (p) => {
                      const x = p.clips
                        .find((c) => c.id === clip.id)
                        ?.taktik?.abschnitte.find((y) => y.id === a.id);
                      if (x) x.situationId = e.target.value || undefined;
                    })
                  }
                >
                  <option value="">(leere Tafel)</option>
                  {situationen.map((sit) => (
                    <option key={sit.id} value={sit.id}>
                      {sit.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t.taktik.gleitetZu}
                  value={a.nachSituationId ?? ''}
                  data-testid="tafel-nach"
                  onChange={(e) =>
                    useProjekt.getState().aendere('Tafel-Animation', (p) => {
                      const x = p.clips
                        .find((c) => c.id === clip.id)
                        ?.taktik?.abschnitte.find((y) => y.id === a.id);
                      if (x) x.nachSituationId = e.target.value || undefined;
                    })
                  }
                >
                  <option value="">{t.taktik.keinZiel}</option>
                  {situationen.map((sit) => (
                    <option key={sit.id} value={sit.id}>
                      {t.taktik.gleitetZu} {sit.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    useProjekt.getState().aendere('Tafel-Abschnitt entfernen', (p) => {
                      const c = p.clips.find((x) => x.id === clip.id);
                      if (c) entferneAbschnitt(c, a.id);
                    })
                  }
                >
                  {t.taktik.entfernen}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ height: 16 }} />
      <KalibrierungPanel />

      <div style={{ height: 16 }} />
      <details>
        <summary className="kicker" style={{ cursor: 'pointer' }}>
          {t.taktik.feld}
        </summary>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }} data-testid="feldmasse">
          {FELD_FELDER.map(([k, name]) => (
            <label key={k}>
              {name}{' '}
              <input
                type="number"
                step="0.1"
                style={{ width: 80 }}
                value={feld[k] as number}
                data-testid={`feld-${k}`}
                onChange={(e) =>
                  setzeFeld({
                    [k]: Number(e.target.value),
                    geprueft: feld.geprueft,
                  } as Partial<FeldMasse>)
                }
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={feld.geprueft}
              data-testid="feld-geprueft"
              onChange={(e) => setzeFeld({ geprueft: e.target.checked })}
            />{' '}
            {t.taktik.feldBestaetigt}
          </label>
        </div>
      </details>
    </section>
  );
}
