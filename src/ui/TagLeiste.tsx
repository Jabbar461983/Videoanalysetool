import { useEffect } from 'react';
import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { useTagging, ZUORDNUNG_TIMEOUT_MS } from '../store/tagging';
import { setzeTag, waehleZuordnungsTeam } from '../tagging/aktionen';
import s from './TagLeiste.module.css';

/** Tag-Leiste unter dem Player plus Zuordnungsanzeige (Team/Nummer) nach dem Taggen. */
export function TagLeiste() {
  const projekt = useProjekt((x) => x.projekt);
  const zuordnung = useTagging((x) => x.zuordnung);
  const zuletzt = useTagging((x) => x.zuletzt);

  // Zuordnungsfenster läuft nach Inaktivität ab (das Tag bleibt)
  useEffect(() => {
    if (!zuordnung) return;
    const id = window.setTimeout(
      () => useTagging.getState().setzeZuordnung(null),
      ZUORDNUNG_TIMEOUT_MS,
    );
    return () => window.clearTimeout(id);
  }, [zuordnung, zuletzt]);

  if (!projekt) return null;
  const sichtbar = projekt.tagDefinitionen.filter((d) => d.sichtbar);
  const tag = zuordnung && projekt.tags.find((x) => x.id === zuordnung.tagId);
  const def = tag && projekt.tagDefinitionen.find((d) => d.id === tag.defId);
  const team = tag?.teamId ? projekt.teams.find((x) => x.id === tag.teamId) : undefined;
  const spieler = tag?.spielerId ? team?.kader.find((x) => x.id === tag.spielerId) : undefined;

  return (
    <div className={s.wrap}>
      <div className={s.leiste} role="toolbar" aria-label={t.tags.leiste} data-testid="tagleiste">
        {sichtbar.map((d) => (
          <button
            key={d.id}
            className={s.tag}
            style={{ borderLeftColor: d.farbe }}
            title={t.tags.setzen(d.name, d.hotkey)}
            onClick={(e) => {
              setzeTag(d.id);
              e.currentTarget.blur(); // Leertaste soll weiter den Player steuern
            }}
          >
            <span>{d.name}</span>
            {d.hotkey && <kbd className={s.kbd}>{d.hotkey}</kbd>}
          </button>
        ))}
      </div>
      {zuordnung && def && (
        <div className={s.zuordnung} role="status" data-testid="zuordnung">
          <strong style={{ color: def.farbe }}>{def.name}</strong>
          <span>
            {t.tags.teamLabel}:{' '}
            {[0, 1].map((i) => (
              <button
                key={i}
                className={s.teamBtn}
                aria-pressed={zuordnung.teamIndex === i}
                onClick={(e) => {
                  waehleZuordnungsTeam(i as 0 | 1);
                  e.currentTarget.blur();
                }}
              >
                {i + 1} {projekt.teams[i]?.kuerzel}
              </button>
            ))}
          </span>
          <span>
            {t.tags.nummerLabel}: <kbd className={s.kbd}>{zuordnung.nummer || '–'}</kbd>
          </span>
          <span className="hinweis">
            {spieler ? `#${spieler.nummer} ${spieler.name}` : team ? team.kuerzel : t.tags.keinTeam}
          </span>
          <span className="hinweis">{t.tags.zuordnungHinweis}</span>
        </div>
      )}
    </div>
  );
}
