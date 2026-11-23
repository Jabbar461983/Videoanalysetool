import { useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Tag } from '../model/typen';
import { useProjekt } from '../store/projektStore';
import { usePlayer } from '../store/player';
import { useTagging } from '../store/tagging';
import { loescheTag } from '../tagging/aktionen';
import {
  filterAktiv,
  filtereTags,
  leererFilter,
  sortiereTags,
  uebernehmeInPlaylist,
} from '../tagging/tagLogik';
import { formatZeit } from '../video/bildmathe';
import s from './Seitenleiste.module.css';

export function TagListe() {
  const projekt = useProjekt((x) => x.projekt);
  const filter = useTagging((x) => x.filter);
  const gewaehlt = useTagging((x) => x.ausgewaehltTagId);
  const [meldung, setMeldung] = useState<string | null>(null);
  if (!projekt) return null;
  const alle = [
    ...projekt.teams[0].kader.map((k) => ({ ...k, team: projekt.teams[0] })),
    ...projekt.teams[1].kader.map((k) => ({ ...k, team: projekt.teams[1] })),
  ];
  const treffer = sortiereTags(
    filtereTags(projekt.tags, filter),
    projekt.quellen.map((q) => q.id),
  );
  const setze = (f: Partial<typeof filter>) =>
    useTagging.getState().setzeFilter({ ...filter, ...f });
  const spielerOptionen = filter.teamId ? alle.filter((x) => x.team.id === filter.teamId) : alle;

  return (
    <section aria-label={t.tags.ereignisse}>
      <p className="kicker">{t.tags.filter}</p>
      <div className={s.raster}>
        <label>
          {t.tags.alleTags}
          <select
            aria-label={t.tags.alleTags}
            value={filter.defIds[0] ?? ''}
            onChange={(e) => setze({ defIds: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">{t.tags.alleTags}</option>
            {projekt.tagDefinitionen.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.tags.teamLabel}
          <select
            aria-label={t.tags.teamLabel}
            value={filter.teamId ?? ''}
            onChange={(e) => setze({ teamId: e.target.value || undefined, spielerId: undefined })}
          >
            <option value="">{t.tags.alleTeams}</option>
            {projekt.teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.kuerzel}
              </option>
            ))}
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          {t.tags.alleSpieler}
          <select
            aria-label={t.tags.alleSpieler}
            value={filter.spielerId ?? ''}
            onChange={(e) => setze({ spielerId: e.target.value || undefined })}
          >
            <option value="">{t.tags.alleSpieler}</option>
            {spielerOptionen.map((x) => (
              <option key={x.id} value={x.id}>
                {x.team.kuerzel} #{x.nummer} {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={s.reihe}>
        {filterAktiv(filter) && (
          <button
            className={s.mini}
            onClick={() => useTagging.getState().setzeFilter(leererFilter())}
          >
            {t.tags.filterZurueck}
          </button>
        )}
        <button
          className={`${s.mini} primaer`}
          disabled={treffer.length === 0}
          onClick={() => {
            let n = 0;
            useProjekt.getState().aendere('Playlist aus Filter', (p) => {
              n = uebernehmeInPlaylist(p, filter);
            });
            setMeldung(t.tags.inPlaylistErgebnis(n));
          }}
        >
          {t.tags.inPlaylist}
        </button>
      </div>
      {meldung && (
        <p className="hinweis" role="status">
          {meldung}
        </p>
      )}

      <p className="kicker" style={{ marginTop: 16 }}>
        {t.tags.ereignisse} · <span className="hinweis">{t.tags.anzahl(treffer.length)}</span>
      </p>
      {projekt.tags.length === 0 && <p className="hinweis">{t.tags.leer}</p>}
      {projekt.tags.length > 0 && treffer.length === 0 && (
        <p className="hinweis">{t.tags.keineTreffer}</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="tagliste">
        {treffer.map((tag) => {
          const def = projekt.tagDefinitionen.find((d) => d.id === tag.defId);
          const team = projekt.teams.find((x) => x.id === tag.teamId);
          const sp = team?.kader.find((x) => x.id === tag.spielerId);
          const q = projekt.quellen.find((x) => x.id === tag.quelleId);
          const offen = gewaehlt === tag.id;
          return (
            <li key={tag.id} className={`${s.zeile} ${offen ? s.aktiv : ''}`}>
              <button
                className={s.klick}
                title={t.tags.springen}
                onClick={() => {
                  useTagging.getState().waehleTag(offen ? null : tag.id);
                  if (q && q.id !== projekt.aktiveQuelleId)
                    useProjekt.getState().aendereStill((p) => {
                      p.aktiveQuelleId = q.id;
                    });
                  usePlayer.getState().suche(tag.zeit);
                }}
              >
                <span className={s.punkt} style={{ background: def?.farbe }} />
                <strong style={{ color: 'var(--bd-ink)' }}>{def?.name ?? '?'}</strong>
                <span className="hinweis">{formatZeit(tag.zeit, q?.fps ?? 25)}</span>
                {team && (
                  <span className="hinweis">
                    {team.kuerzel}
                    {sp ? ` #${sp.nummer}` : ''}
                  </span>
                )}
              </button>
              {tag.notiz && !offen && <div className="hinweis">{tag.notiz}</div>}
              {offen && <TagEditor tagId={tag.id} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TagEditor({ tagId }: { tagId: string }) {
  const projekt = useProjekt((x) => x.projekt)!;
  const tag = projekt.tags.find((x) => x.id === tagId);
  if (!tag) return null;
  const team = projekt.teams.find((x) => x.id === tag.teamId);
  const aendere = (name: string, fn: (tg: Tag) => void) =>
    useProjekt.getState().aendere(name, (p) => {
      const x = p.tags.find((y) => y.id === tagId);
      if (x) fn(x);
    });
  const fps = projekt.quellen.find((q) => q.id === tag.quelleId)?.fps ?? 25;
  return (
    <div>
      <div className={s.raster}>
        <label>
          {t.tags.teamLabel}
          <select
            value={tag.teamId ?? ''}
            onChange={(e) =>
              aendere('Tag: Team', (x) => {
                x.teamId = e.target.value || undefined;
                delete x.spielerId;
              })
            }
          >
            <option value="">{t.tags.keinTeam}</option>
            {projekt.teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.kuerzel}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.setup.spielerName}
          <select
            value={tag.spielerId ?? ''}
            onChange={(e) =>
              aendere('Tag: Spieler', (x) => {
                x.spielerId = e.target.value || undefined;
              })
            }
            disabled={!team}
          >
            <option value="">{t.tags.keinSpieler}</option>
            {team?.kader.map((x) => (
              <option key={x.id} value={x.id}>
                #{x.nummer} {x.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          {t.tags.notiz}
          <input
            type="text"
            value={tag.notiz ?? ''}
            onChange={(e) =>
              aendere('Tag: Notiz', (x) => {
                x.notiz = e.target.value || undefined;
              })
            }
          />
        </label>
      </div>
      <div className={s.reihe}>
        <button
          className={s.mini}
          aria-label="Ein Bild zurück"
          onClick={() =>
            aendere('Tag: Zeit', (x) => {
              x.zeit = Math.max(0, Math.round((x.zeit - 1 / fps) * 1000) / 1000);
            })
          }
        >
          ◀|
        </button>
        <span className="hinweis">
          {t.tags.zeit}: {formatZeit(tag.zeit, fps)}
        </span>
        <button
          className={s.mini}
          aria-label="Ein Bild vor"
          onClick={() =>
            aendere('Tag: Zeit', (x) => {
              x.zeit = Math.round((x.zeit + 1 / fps) * 1000) / 1000;
            })
          }
        >
          |▶
        </button>
        <button className={`${s.mini} gefahr`} onClick={() => loescheTag(tagId)}>
          {t.tags.loeschen}
        </button>
      </div>
    </div>
  );
}
