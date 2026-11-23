import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { useZeichnen, type Modus } from '../store/zeichnen';
import { PALETTE } from '../zeichnen/geometrie';
import { aendereAnimation, aendereStil, schliesseZone } from '../zeichnen/aktionen';
import s from './Werkzeugleiste.module.css';

const WERKZEUGE: { id: Modus; label: string }[] = [
  { id: 'auswahl', label: t.zeichnen.auswahl },
  { id: 'pfeil', label: t.zeichnen.pfeil },
  { id: 'linie', label: t.zeichnen.linie },
  { id: 'freihand', label: t.zeichnen.freihand },
  { id: 'kreis', label: t.zeichnen.kreis },
  { id: 'zone', label: t.zeichnen.zone },
  { id: 'text', label: t.zeichnen.text },
  { id: 'marker', label: t.zeichnen.marker },
];

/** Werkzeugleiste im Clip-Editor: Werkzeug, Farbe, Stärke, Deckkraft, Strichart, Pfeilspitzen. */
export function Werkzeugleiste() {
  const werkzeug = useZeichnen((z) => z.werkzeug);
  const stil = useZeichnen((z) => z.stil);
  const druck = useZeichnen((z) => z.druck);
  const anim = useZeichnen((z) => z.animation);
  const entwurf = useZeichnen((z) => z.entwurf);
  const anhalten = useProjekt((x) => x.projekt?.einstellungen.zeichnenAnhalten ?? true);
  // Bei Auswahl zeigt die Leiste den Stil der ausgewählten Zeichnung
  const auswahl = useProjekt((x) =>
    x.projekt?.zeichnungen.find((z) => z.id === useZeichnen.getState().auswahlId),
  );
  const aktuell = werkzeug === 'auswahl' && auswahl ? auswahl.stil : stil;
  const aktAnim = werkzeug === 'auswahl' && auswahl ? auswahl.animation : anim;

  return (
    <div
      className={s.leiste}
      role="toolbar"
      aria-label={t.zeichnen.leiste}
      data-testid="werkzeugleiste"
    >
      {WERKZEUGE.map((w) => (
        <button
          key={w.id}
          className={s.tool}
          aria-pressed={werkzeug === w.id}
          data-testid={`werkzeug-${w.id}`}
          onClick={(e) => {
            if (werkzeug === 'zone' && w.id !== 'zone') schliesseZone();
            useZeichnen.getState().setzeWerkzeug(w.id);
            e.currentTarget.blur();
          }}
        >
          {w.label}
        </button>
      ))}
      {entwurf?.werkzeug === 'zone' && entwurf.punkte.length >= 3 && (
        <button className="primaer" onClick={schliesseZone}>
          {t.zeichnen.zoneFertig}
        </button>
      )}
      <span className={s.trenner} />
      {PALETTE.map((f) => (
        <button
          key={f.wert}
          className={s.farbe}
          style={{ background: f.wert }}
          aria-label={`${t.zeichnen.farbe}: ${f.name}`}
          aria-pressed={aktuell.farbe.toLowerCase() === f.wert.toLowerCase()}
          data-testid={`farbe-${f.name}`}
          onClick={(e) => {
            aendereStil({ farbe: f.wert });
            e.currentTarget.blur();
          }}
        />
      ))}
      <span className={s.trenner} />
      <label className={s.regler}>
        {t.zeichnen.staerke}
        <input
          type="range"
          min={2}
          max={20}
          value={aktuell.staerke}
          aria-label={t.zeichnen.staerke}
          onChange={(e) => aendereStil({ staerke: Number(e.target.value) })}
        />
      </label>
      <label className={s.regler}>
        {t.zeichnen.deckkraft}
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(aktuell.deckkraft * 100)}
          aria-label={t.zeichnen.deckkraft}
          onChange={(e) => aendereStil({ deckkraft: Number(e.target.value) / 100 })}
        />
      </label>
      <label className={s.regler}>
        <input
          type="checkbox"
          checked={aktuell.gestrichelt}
          data-testid="gestrichelt"
          onChange={(e) => aendereStil({ gestrichelt: e.target.checked })}
        />
        {t.zeichnen.gestrichelt}
      </label>
      <label className={s.regler}>
        {t.zeichnen.spitze}
        <select
          value={aktuell.spitze}
          aria-label={t.zeichnen.spitze}
          onChange={(e) => aendereStil({ spitze: e.target.value as 'ende' | 'beide' | 'keine' })}
        >
          {(['ende', 'beide', 'keine'] as const).map((x) => (
            <option key={x} value={x}>
              {t.zeichnen.spitzen[x]}
            </option>
          ))}
        </select>
      </label>
      <span className={s.trenner} />
      <label className={s.regler}>
        {t.zeichnen.animation}
        <select
          value={aktAnim.ein}
          aria-label={t.zeichnen.animation}
          data-testid="animation"
          onChange={(e) =>
            aendereAnimation({
              ein: e.target.value as 'keine' | 'einblenden' | 'zeichnen',
              dauerEin: e.target.value === 'zeichnen' ? 0.8 : 0.3,
            })
          }
        >
          {(['keine', 'einblenden', 'zeichnen'] as const).map((a) => (
            <option key={a} value={a}>
              {t.zeichnen.animEin[a]}
            </option>
          ))}
        </select>
      </label>
      <label className={s.regler}>
        <input
          type="checkbox"
          checked={aktAnim.aus === 'ausblenden'}
          onChange={(e) => aendereAnimation({ aus: e.target.checked ? 'ausblenden' : 'keine' })}
        />
        {t.zeichnen.ausAnim}
      </label>
      <span className={s.trenner} />
      <label className={s.regler}>
        <input
          type="checkbox"
          checked={druck}
          onChange={(e) => useZeichnen.getState().setzeDruck(e.target.checked)}
        />
        {t.zeichnen.druck}
      </label>
      <label className={s.regler}>
        <input
          type="checkbox"
          checked={anhalten}
          data-testid="anhalten"
          onChange={(e) =>
            useProjekt.getState().aendereStill((p) => {
              p.einstellungen.zeichnenAnhalten = e.target.checked;
            })
          }
        />
        {t.zeichnen.anhalten}
      </label>
    </div>
  );
}
