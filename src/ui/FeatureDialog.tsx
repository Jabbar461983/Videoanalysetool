import { useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { erkenneFeatures, type Features } from '../platform/features';

const KEY = 'bdva-feature-hinweis-gesehen';

export function FeatureDialog() {
  const [f, setF] = useState<Features | null>(null);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    void erkenneFeatures().then((x) => {
      setF(x);
      let gesehen = false;
      try {
        gesehen = localStorage.getItem(KEY) === '1';
      } catch {
        /* egal */
      }
      const kritisch = !x.webcodecs;
      setOffen(kritisch || (!gesehen && (!x.webgpu || !x.fsAccess)));
    });
  }, []);
  if (!offen || !f) return null;
  const zeilen: [boolean, string, string][] = [
    [f.webcodecs, t.features.webcodecs, t.features.fehltWebcodecs],
    [f.webgpu, t.features.webgpu, t.features.fehltWebgpu],
    [f.fsAccess, t.features.fsAccess, t.features.fehltFs],
    [f.persist, t.features.persist, ''],
    [f.h264, t.features.h264, ''],
    [f.hevc, t.features.hevc, t.features.fehltHevc],
  ];
  const zu = (merken: boolean) => {
    if (merken) {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* egal */
      }
    }
    setOffen(false);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="fd-t" style={ueberzug}>
      <div style={box}>
        <h2 id="fd-t" style={{ fontSize: 18, marginBottom: 12 }}>
          {t.features.titel}
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          {zeilen.map(([ok, name, hint]) => (
            <li key={name} style={{ padding: '6px 0', borderBottom: '1px solid var(--bd-rule)' }}>
              <strong style={{ color: ok ? 'var(--bd-ink)' : 'var(--bd-gold)' }}>
                {ok ? '✓' : '!'} {name}
              </strong>
              {!ok && hint && <div className="hinweis">{hint}</div>}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primaer" onClick={() => zu(false)}>
            {t.features.schliessen}
          </button>
          <button onClick={() => zu(true)}>{t.features.nichtMehrZeigen}</button>
        </div>
      </div>
    </div>
  );
}
const ueberzug: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bd-scrim)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 100,
  padding: 16,
};
const box: React.CSSProperties = {
  background: 'var(--bd-surface-raised)',
  border: '1px solid var(--bd-rule)',
  padding: 24,
  maxWidth: 520,
  width: '100%',
};
