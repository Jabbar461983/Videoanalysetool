import { useEffect, useMemo, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Projekt } from '../model/typen';
import {
  baueAutoEintraege,
  findeTreffer,
  fuelleAutomatisch,
  vorschlagName,
  type AutoAuswahl,
} from '../schnitt/autoPlaylist';
import { useAutoPlaylist } from '../store/autoPlaylist';
import { useProjekt } from '../store/projektStore';
import { formatDauer } from '../export/format';
import { formatZeit } from '../video/bildmathe';

const NEU = '__neu';

/** Schnellvorlagen: Tag-Arten anhand ihres Namens finden (Tore, Bullys, Strafen, Torschüsse). */
function vorlagen(p: Projekt): { id: string; label: string; defIds: string[] }[] {
  const finde = (re: RegExp) => p.tagDefinitionen.filter((d) => re.test(d.name)).map((d) => d.id);
  return [
    {
      id: 'tore',
      label: t.autoPlaylist.vorlageTore,
      defIds: p.tagDefinitionen.filter((d) => d.istTor).map((d) => d.id),
    },
    { id: 'bully', label: t.autoPlaylist.vorlageBully, defIds: finde(/bully/i) },
    {
      id: 'strafen',
      label: t.autoPlaylist.vorlageStrafen,
      defIds: finde(/strafe|powerplay|boxplay/i),
    },
    { id: 'schuesse', label: t.autoPlaylist.vorlageSchuesse, defIds: finde(/schuss|parade/i) },
  ].filter((v) => v.defIds.length > 0);
}

/** Dialog: Playlist automatisch aus Tag-, Team-, Spieler- und Video-Filter füllen (anhängen, mit Titelfolien je Thema). */
export function AutoPlaylistDialog() {
  const offen = useAutoPlaylist((x) => x.offen);
  const start = useAutoPlaylist((x) => x.auswahl);
  const projekt = useProjekt((x) => x.projekt);
  const [a, setA] = useState<AutoAuswahl>(start);
  const [gruppieren, setGruppieren] = useState(true);
  const [ziel, setZiel] = useState<string>(NEU);
  const [name, setName] = useState('');
  const [nameVonHand, setNameVonHand] = useState(false);

  useEffect(() => {
    if (!offen) return;
    setA(start);
    setGruppieren(true);
    setZiel(NEU);
    setNameVonHand(false);
  }, [offen, start]);

  const treffer = useMemo(() => (projekt ? findeTreffer(projekt, a) : []), [projekt, a]);
  const gewaehlt = treffer.filter((x) => !a.ausgeschlossen.includes(x.tag.id));
  const zielPlaylist = projekt?.playlisten.find((x) => x.id === ziel);
  const neueEintraege = useMemo(
    () => (projekt ? baueAutoEintraege(projekt, a, { gruppieren }, zielPlaylist?.eintraege) : []),
    [projekt, a, gruppieren, zielPlaylist],
  );
  const neueSzenen = neueEintraege.filter((e) => e.typ === 'clip').length;

  useEffect(() => {
    if (projekt && !nameVonHand) setName(vorschlagName(projekt, a));
  }, [projekt, a, nameVonHand]);

  if (!offen || !projekt) return null;
  const fps = projekt.quellen[0]?.fps ?? 25;
  const dauer = gewaehlt.reduce((s, x) => s + Math.max(0, x.clip.out - x.clip.in), 0);
  const aendere = (teil: Partial<AutoAuswahl>) =>
    setA((alt) => ({ ...alt, ...teil, ausgeschlossen: [] }));
  const schliesse = () => useAutoPlaylist.getState().schliesse();
  const toggleDef = (id: string) =>
    aendere({
      defIds: a.defIds.includes(id) ? a.defIds.filter((x) => x !== id) : [...a.defIds, id],
    });
  const quelleName = (id: string) => projekt.quellen.find((q) => q.id === id)?.dateiname ?? '';
  const defName = (id: string) => projekt.tagDefinitionen.find((d) => d.id === id);

  const uebernehmen = () => {
    useProjekt.getState().aendere('Playlist automatisch füllen', (p) => {
      fuelleAutomatisch(p, ziel === NEU ? { name } : ziel, a, { gruppieren });
    });
    schliesse();
  };

  const chip = (aktiv: boolean) => ({
    borderRadius: 999,
    ...(aktiv ? { borderColor: 'var(--bd-gold)', color: 'var(--bd-gold)' } : {}),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.autoPlaylist.titel}
      data-testid="auto-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        zIndex: 85,
        display: 'grid',
        placeItems: 'center',
        padding: 12,
      }}
    >
      <div
        style={{
          background: 'var(--bd-surface-raised)',
          border: '1px solid var(--bd-rule)',
          padding: 16,
          width: 'min(720px, 100%)',
          maxHeight: '100%',
          overflow: 'auto',
        }}
      >
        <p className="kicker">{t.autoPlaylist.titel}</p>

        <p className="hinweis">{t.autoPlaylist.vorlagen}</p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {vorlagen(projekt).map((v) => (
            <button
              key={v.id}
              data-testid={`vorlage-${v.id}`}
              onClick={() => aendere({ defIds: v.defIds })}
            >
              {v.label}
            </button>
          ))}
        </div>

        <p className="kicker" style={{ marginTop: 12 }}>
          {t.autoPlaylist.was}
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-testid="auto-tags">
          {projekt.tagDefinitionen.map((d) => (
            <button
              key={d.id}
              aria-pressed={a.defIds.includes(d.id)}
              style={chip(a.defIds.includes(d.id))}
              onClick={() => toggleDef(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
        {a.defIds.length === 0 && <p className="hinweis">{t.autoPlaylist.alleTags}</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 8,
            marginTop: 12,
          }}
        >
          <label>
            {t.autoPlaylist.wer}
            <select
              data-testid="auto-spieler"
              style={{ width: '100%' }}
              value={a.spielerId ? `s:${a.spielerId}` : a.teamId ? `t:${a.teamId}` : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('s:')) {
                  const id = v.slice(2);
                  const tm = projekt.teams.find((x) => x.kader.some((s) => s.id === id));
                  aendere({ spielerId: id, teamId: tm?.id });
                } else if (v.startsWith('t:'))
                  aendere({ teamId: v.slice(2), spielerId: undefined });
                else aendere({ teamId: undefined, spielerId: undefined });
              }}
            >
              <option value="">{t.autoPlaylist.alle}</option>
              {projekt.teams.map((tm) => (
                <optgroup key={tm.id} label={`${tm.kuerzel} – ${tm.name}`}>
                  <option value={`t:${tm.id}`}>{t.autoPlaylist.ganzesTeam(tm.kuerzel)}</option>
                  {tm.kader.map((s) => (
                    <option key={s.id} value={`s:${s.id}`}>
                      #{s.nummer} {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            {t.autoPlaylist.wo}
            <select
              style={{ width: '100%' }}
              value={a.quelleId ?? ''}
              onChange={(e) => aendere({ quelleId: e.target.value || undefined })}
            >
              <option value="">{t.autoPlaylist.alleVideos}</option>
              {projekt.quellen.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.dateiname}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p
          className="kicker"
          style={{ marginTop: 12 }}
          data-testid="auto-zusammenfassung"
          role="status"
        >
          {t.autoPlaylist.zusammenfassung(gewaehlt.length, formatDauer(dauer))}
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            maxHeight: 200,
            overflow: 'auto',
            borderTop: '1px solid var(--bd-rule)',
          }}
          data-testid="auto-treffer"
        >
          {treffer.map((x) => {
            const an = !a.ausgeschlossen.includes(x.tag.id);
            const sp = projekt.teams
              .flatMap((tm) => tm.kader)
              .find((s) => s.id === x.tag.spielerId);
            return (
              <li
                key={x.tag.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  borderBottom: '1px solid var(--bd-rule)',
                }}
              >
                <label
                  style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minHeight: 32 }}
                >
                  <input
                    type="checkbox"
                    checked={an}
                    onChange={() =>
                      setA((alt) => ({
                        ...alt,
                        ausgeschlossen: an
                          ? [...alt.ausgeschlossen, x.tag.id]
                          : alt.ausgeschlossen.filter((i) => i !== x.tag.id),
                      }))
                    }
                  />
                  <strong style={{ color: defName(x.tag.defId)?.farbe ?? 'var(--bd-ink)' }}>
                    {defName(x.tag.defId)?.name}
                  </strong>
                  <span className="hinweis">
                    {projekt.quellen.length > 1 ? `${quelleName(x.tag.quelleId)} · ` : ''}
                    {formatZeit(x.tag.zeit, fps)}
                    {sp ? ` · #${sp.nummer} ${sp.name}` : ''}
                  </span>
                </label>
              </li>
            );
          })}
          {treffer.length === 0 && <li className="hinweis">{t.autoPlaylist.keineTreffer}</li>}
        </ul>

        <p className="kicker" style={{ marginTop: 12 }}>
          {t.autoPlaylist.ablauf}
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={gruppieren}
            data-testid="auto-gruppieren"
            onChange={(e) => setGruppieren(e.target.checked)}
          />
          {t.autoPlaylist.gruppieren}
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 8,
            marginTop: 8,
          }}
        >
          <label>
            {t.autoPlaylist.zielLabel}
            <select
              data-testid="auto-ziel"
              style={{ width: '100%' }}
              value={ziel}
              onChange={(e) => setZiel(e.target.value)}
            >
              <option value={NEU}>{t.autoPlaylist.neuePlaylist}</option>
              {projekt.playlisten.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {t.autoPlaylist.anhaengen(pl.name)}
                </option>
              ))}
            </select>
          </label>
          {ziel === NEU && (
            <label>
              {t.autoPlaylist.name}
              <input
                type="text"
                style={{ width: '100%' }}
                value={name}
                data-testid="auto-name"
                onChange={(e) => {
                  setName(e.target.value);
                  setNameVonHand(true);
                }}
              />
            </label>
          )}
        </div>
        <p className="hinweis" data-testid="auto-neu">
          {t.autoPlaylist.neu(neueSzenen, neueEintraege.length - neueSzenen)}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={schliesse}>{t.taktik.abbrechen}</button>
          <button
            className="primaer"
            data-testid="auto-uebernehmen"
            disabled={neueSzenen === 0 || (ziel === NEU && !name.trim())}
            onClick={uebernehmen}
          >
            {t.autoPlaylist.uebernehmen}
          </button>
        </div>
      </div>
    </div>
  );
}
