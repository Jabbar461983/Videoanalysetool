import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { usePlayer } from '../store/player';
import { useTagging } from '../store/tagging';
import { filtereTags } from '../tagging/tagLogik';
import { formatZeit } from '../video/bildmathe';
import s from './Seitenleiste.module.css';

/** Grundliste der Clips (Schnitt-Werkzeuge folgen in Etappe 2). Folgt dem Tag-Filter. */
export function ClipListe() {
  const projekt = useProjekt((x) => x.projekt);
  const filter = useTagging((x) => x.filter);
  if (!projekt) return null;
  const sichtbareTags = new Set(filtereTags(projekt.tags, filter).map((x) => x.id));
  const filterAktiv = filter.defIds.length > 0 || filter.teamId || filter.spielerId;
  const clips = projekt.clips
    .filter((c) => !filterAktiv || (c.tagId && sichtbareTags.has(c.tagId)))
    .sort(
      (a, b) =>
        projekt.quellen.findIndex((q) => q.id === a.quelleId) -
          projekt.quellen.findIndex((q) => q.id === b.quelleId) || a.in - b.in,
    );
  return (
    <section aria-label={t.clips.titel}>
      <p className="kicker">
        {t.clips.titel} · <span className="hinweis">{clips.length}</span>
      </p>
      {clips.length === 0 && <p className="hinweis">{t.clips.leer}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="clipliste">
        {clips.map((c) => {
          const q = projekt.quellen.find((x) => x.id === c.quelleId);
          const tag = c.tagId ? projekt.tags.find((x) => x.id === c.tagId) : undefined;
          const def = tag && projekt.tagDefinitionen.find((d) => d.id === tag.defId);
          return (
            <li key={c.id} className={s.zeile}>
              <button
                className={s.klick}
                title={t.clips.abspielen}
                onClick={() => {
                  if (q && q.id !== projekt.aktiveQuelleId)
                    useProjekt.getState().aendereStill((p) => {
                      p.aktiveQuelleId = q.id;
                    });
                  usePlayer.getState().suche(c.in);
                }}
              >
                <span className={s.punkt} style={{ background: def?.farbe ?? 'var(--bd-gold)' }} />
                <strong style={{ color: 'var(--bd-ink)' }}>{c.name}</strong>
              </button>
              <div className="hinweis">
                {formatZeit(c.in, q?.fps ?? 25)} – {formatZeit(c.out, q?.fps ?? 25)} ·{' '}
                {t.clips.dauer} {(c.out - c.in).toFixed(1)} s
                {def ? ` · ${t.clips.aus(def.name)}` : ''}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
