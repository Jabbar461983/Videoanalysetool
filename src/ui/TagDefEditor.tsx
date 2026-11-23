import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { neueId } from '../model/schema';
import type { TagDef } from '../model/typen';
import { RESERVIERTE_TASTEN } from '../tagging/standardTags';
import { entferneTag } from '../tagging/tagLogik';
import { pruefeHotkey } from '../tagging/kuerzel';
import { VorlagenLeiste } from './VorlagenLeiste';
import s from './Seitenleiste.module.css';

export function TagDefEditor() {
  const defs = useProjekt((x) => x.projekt?.tagDefinitionen);
  if (!defs) return null;
  const aendere = (n: string, fn: (d: TagDef[]) => void) =>
    useProjekt.getState().aendere(n, (p) => fn(p.tagDefinitionen));
  const bearbeite = (id: string, fn: (d: TagDef) => void) =>
    aendere('Tag-Definition', (liste) => {
      const d = liste.find((x) => x.id === id);
      if (d) fn(d);
    });
  const verschiebe = (i: number, richtung: -1 | 1) =>
    aendere('Tag sortieren', (l) => {
      const j = i + richtung;
      if (j < 0 || j >= l.length) return;
      const a = l[i]!,
        b = l[j]!;
      l[i] = b;
      l[j] = a;
    });

  return (
    <section className={s.abschnitt} aria-label={t.setup.tagDefs}>
      <p className="kicker">{t.setup.tagDefs}</p>
      <VorlagenLeiste
        typ="tagset"
        label={t.setup.vorlageTagset}
        vorschlag="Mein Tag-Set"
        daten={() => defs}
        anwenden={(d) =>
          aendere('Tag-Set-Vorlage', (l) => {
            l.splice(0, l.length, ...(d as TagDef[]));
          })
        }
      />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="tagdefs">
        {defs.map((d, i) => {
          const status = pruefeHotkey(d.hotkey, d.id, defs, RESERVIERTE_TASTEN);
          return (
            <li key={d.id} className={s.zeile}>
              <div className={s.reihe} style={{ margin: 0 }}>
                <input
                  type="color"
                  aria-label={`${t.setup.tagFarbe}: ${d.name}`}
                  value={d.farbe}
                  onChange={(e) =>
                    bearbeite(d.id, (x) => {
                      x.farbe = e.target.value;
                    })
                  }
                  style={{ width: 44, padding: 0 }}
                />
                <input
                  type="text"
                  aria-label={`${t.setup.tagName}: ${d.name}`}
                  value={d.name}
                  onChange={(e) =>
                    bearbeite(d.id, (x) => {
                      x.name = e.target.value;
                    })
                  }
                  style={{ flex: 1, minWidth: 100 }}
                />
                <button
                  className={s.mini}
                  aria-label={t.setup.hoch}
                  disabled={i === 0}
                  onClick={() => verschiebe(i, -1)}
                >
                  ↑
                </button>
                <button
                  className={s.mini}
                  aria-label={t.setup.runter}
                  disabled={i === defs.length - 1}
                  onClick={() => verschiebe(i, 1)}
                >
                  ↓
                </button>
              </div>
              <div className={s.reihe}>
                <label className="hinweis">
                  {t.setup.tagHotkey}{' '}
                  <input
                    type="text"
                    maxLength={1}
                    value={d.hotkey ?? ''}
                    aria-invalid={status !== 'ok'}
                    style={{ width: 44, textAlign: 'center', textTransform: 'uppercase' }}
                    onChange={(e) =>
                      bearbeite(d.id, (x) => {
                        x.hotkey = e.target.value.toUpperCase() || undefined;
                      })
                    }
                  />
                </label>
                <label className="hinweis">
                  {t.setup.tagVorlauf}{' '}
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={d.vorlauf}
                    key={`v${d.vorlauf}`}
                    style={{ width: 52 }}
                    onBlur={(e) => {
                      const n = Number(e.target.value.replace(',', '.'));
                      if (Number.isFinite(n) && n >= 0 && n <= 120)
                        bearbeite(d.id, (x) => {
                          x.vorlauf = n;
                        });
                      else e.target.value = String(d.vorlauf);
                    }}
                  />
                </label>
                <label className="hinweis">
                  {t.setup.tagNachlauf}{' '}
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={d.nachlauf}
                    key={`n${d.nachlauf}`}
                    style={{ width: 52 }}
                    onBlur={(e) => {
                      const n = Number(e.target.value.replace(',', '.'));
                      if (Number.isFinite(n) && n >= 0 && n <= 120)
                        bearbeite(d.id, (x) => {
                          x.nachlauf = n;
                        });
                      else e.target.value = String(d.nachlauf);
                    }}
                  />
                </label>
              </div>
              {status !== 'ok' && (
                <p className={s.fehler} role="alert">
                  {t.setup.hotkeyFehler[status]}
                </p>
              )}
              <div className={s.reihe}>
                <label className="hinweis">
                  <input
                    type="checkbox"
                    checked={d.istTor}
                    onChange={(e) =>
                      bearbeite(d.id, (x) => {
                        x.istTor = e.target.checked;
                      })
                    }
                  />{' '}
                  {t.setup.tagIstTor}
                </label>
                <label className="hinweis">
                  <input
                    type="checkbox"
                    checked={d.sichtbar}
                    onChange={(e) =>
                      bearbeite(d.id, (x) => {
                        x.sichtbar = e.target.checked;
                      })
                    }
                  />{' '}
                  {t.setup.tagSichtbar}
                </label>
                {!d.fest && (
                  <button
                    className={`${s.mini} gefahr`}
                    onClick={() =>
                      useProjekt.getState().aendere('Tag-Definition löschen', (p) => {
                        for (const tg of p.tags.filter((x) => x.defId === d.id))
                          entferneTag(p, tg.id);
                        p.tagDefinitionen = p.tagDefinitionen.filter((x) => x.id !== d.id);
                      })
                    }
                  >
                    {t.setup.entfernen}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        className="primaer"
        onClick={() =>
          aendere('Eigener Tag', (l) => {
            l.push({
              id: neueId(),
              name: t.setup.tagNeu,
              farbe: '#ffffff',
              vorlauf: 8,
              nachlauf: 4,
              istTor: false,
              sichtbar: true,
              fest: false,
            });
          })
        }
      >
        {t.setup.tagNeu}
      </button>
    </section>
  );
}
