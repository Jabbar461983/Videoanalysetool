import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { useLayout } from '../store/layout';
import { loescheLayout } from './speicher';
import {
  aktualisiereBenanntes,
  benenneBenanntesUm,
  ladeBenannte,
  loescheBenanntes,
  MAX_NAME,
  speichereBenanntes,
  type BenanntesLayout,
  type NamensFehler,
} from './layouts';
import { fensterMoeglich, oeffneInFenster } from './popout';
import {
  baueStandardLayout,
  FERTIGE_LAYOUTS,
  MODULE,
  verbergeModul,
  zeigeModul,
  type LayoutMasse,
} from './standard';
import s from './layout.module.css';

const fehlerText = (f: NamensFehler) => t.layout.namensFehler[f];

/** Menü «Ansicht»: Module ein-/ausblenden, Layouts speichern und wechseln, Fenster zurückholen. */
export function Fenstermenue() {
  const api = useLayout((l) => l.api);
  const fenster = useLayout((l) => l.fenster);
  const [offen, setOffen] = useState(false);
  const [namen, setNamen] = useState<BenanntesLayout[]>(ladeBenannte);
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState('');
  const [, setTick] = useState(0);
  const wurzel = useRef<HTMLDivElement>(null);

  // Menü bei Änderungen am Layout aktuell halten (Module sichtbar?)
  useEffect(() => {
    if (!api) return;
    const d = [api.onDidLayoutChange(() => setTick((x) => x + 1))];
    return () => d.forEach((x) => x.dispose());
  }, [api]);

  // Klick daneben oder Esc schliesst das Menü
  useEffect(() => {
    if (!offen) return;
    const aussen = (e: PointerEvent) => {
      if (wurzel.current && !wurzel.current.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false);
    document.addEventListener('pointerdown', aussen);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('pointerdown', aussen);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  if (!api) return null;
  const popouts = fenster > 0;

  const aufbauen = (masse: LayoutMasse) => {
    api.getPopouts().forEach((p) => p.window.close());
    loescheLayout();
    baueStandardLayout(api, api.width, api.height, masse);
  };
  const laden = (l: BenanntesLayout) => {
    api.getPopouts().forEach((p) => p.window.close());
    try {
      api.clear();
      api.fromJSON(l.json);
    } catch {
      baueStandardLayout(api, api.width, api.height);
      setFehler(t.layout.ladenFehler);
    }
    setOffen(false);
  };
  const speichern = () => {
    setFehler('');
    const r = speichereBenanntes(name, api.toJSON());
    if (!r.ok) return setFehler(fehlerText(r.fehler));
    setName('');
    setNamen(ladeBenannte());
  };

  return (
    <div className={s.menueWurzel} ref={wurzel}>
      <button
        data-testid="ansicht-menue"
        aria-expanded={offen}
        aria-haspopup="true"
        onClick={() => {
          setNamen(ladeBenannte());
          setOffen(!offen);
        }}
      >
        {t.layout.ansicht} ▾
      </button>
      {offen && (
        <div
          className={s.menue}
          role="menu"
          aria-label={t.layout.ansicht}
          data-testid="ansicht-panel"
        >
          <p className="kicker">{t.layout.module}</p>
          <ul className={s.menueListe}>
            {MODULE.map((m) => {
              const da = !!api.getPanel(m.id);
              return (
                <li key={m.id}>
                  <label className={s.menueZeile}>
                    <input
                      type="checkbox"
                      checked={da}
                      disabled={m.fest}
                      data-testid={`modul-${m.id}`}
                      onChange={(e) =>
                        e.target.checked ? zeigeModul(api, m.id) : verbergeModul(api, m.id)
                      }
                    />
                    {m.titel}
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="kicker">{t.layout.layouts}</p>
          <ul className={s.menueListe}>
            {FERTIGE_LAYOUTS.map((l) => (
              <li key={l.name} className={s.menueZeile}>
                <button
                  data-testid={l.name === 'Standard' ? 'layout-reset' : `layout-fertig-${l.name}`}
                  title={l.name === 'Standard' ? t.layout.zuruecksetzenHinweis : undefined}
                  onClick={() => {
                    aufbauen(l.masse);
                    setOffen(false);
                  }}
                >
                  {l.name === 'Standard' ? t.layout.zuruecksetzen : l.name}
                </button>
              </li>
            ))}
            {namen.map((l) => (
              <li key={l.name} className={s.menueZeile}>
                <button
                  data-testid={`layout-laden-${l.name}`}
                  onClick={() => laden(l)}
                  style={{ flex: 1, textAlign: 'left' }}
                >
                  {l.name}
                </button>
                <button
                  title={t.layout.ueberschreiben}
                  aria-label={`${t.layout.ueberschreiben}: ${l.name}`}
                  disabled={popouts}
                  onClick={() => {
                    aktualisiereBenanntes(l.name, api.toJSON());
                    setNamen(ladeBenannte());
                  }}
                >
                  ⟳
                </button>
                <button
                  aria-label={`${t.layout.umbenennen}: ${l.name}`}
                  title={t.layout.umbenennen}
                  onClick={() => {
                    const n = window.prompt(t.layout.neuerName, l.name);
                    if (n === null) return;
                    const r = benenneBenanntesUm(l.name, n);
                    setFehler(r.ok ? '' : fehlerText(r.fehler));
                    setNamen(ladeBenannte());
                  }}
                >
                  ✎
                </button>
                <button
                  className="gefahr"
                  aria-label={`${t.layout.loeschen}: ${l.name}`}
                  title={t.layout.loeschen}
                  onClick={() => {
                    if (!window.confirm(t.layout.loeschenFrage(l.name))) return;
                    loescheBenanntes(l.name);
                    setNamen(ladeBenannte());
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className={s.menueZeile}>
            <input
              type="text"
              value={name}
              maxLength={MAX_NAME}
              placeholder={t.layout.namePlatzhalter}
              aria-label={t.layout.namePlatzhalter}
              data-testid="layout-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && speichern()}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              className="primaer"
              data-testid="layout-speichern"
              disabled={popouts}
              title={popouts ? t.layout.speichernNurOhneFenster : undefined}
              onClick={speichern}
            >
              {t.layout.speichern}
            </button>
          </div>
          {fehler && (
            <p
              role="alert"
              className="hinweis"
              data-testid="layout-fehler"
              style={{ color: '#e57373' }}
            >
              {fehler}
            </p>
          )}

          {(popouts || fensterMoeglich()) && <p className="kicker">{t.layout.fenster}</p>}
          {fensterMoeglich() && (
            <div className={s.menueZeile}>
              <button
                data-testid="menue-zweiter-bildschirm"
                onClick={() => {
                  const g = api.getPanel('buehne')?.group;
                  if (g) void oeffneInFenster(api, g, true);
                  setOffen(false);
                }}
              >
                {t.layout.videoZweiterBildschirm}
              </button>
            </div>
          )}
          {popouts && (
            <div className={s.menueZeile}>
              <button
                data-testid="menue-fenster-zurueck"
                onClick={() => api.getPopouts().forEach((p) => p.window.close())}
              >
                {t.layout.alleZurueck(fenster)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
