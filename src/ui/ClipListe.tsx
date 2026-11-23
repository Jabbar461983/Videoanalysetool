import { useState } from 'react';
import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useSchnitt } from '../store/schnitt';
import { useTagging } from '../store/tagging';
import { useUi } from '../store/ui';
import { filtereTags } from '../tagging/tagLogik';
import {
  dupliziereClip,
  entferneClip,
  neuerClipEintrag,
  sichereAktivePlaylist,
} from '../schnitt/schnittLogik';
import { speichereClipAusPunkten } from '../schnitt/aktionen';
import { clipDauer } from '../wiedergabe/zeitachse';
import { formatZeit } from '../video/bildmathe';
import { ClipEditor } from './ClipEditor';
import { ClipVorschau } from './ClipVorschau';
import s from './Seitenleiste.module.css';

/** Clip-Bibliothek: Vorschaubild, Dauer, Tags, Umbenennen, Duplizieren, Löschen, Editor, Playlist. */
export function ClipListe() {
  const projekt = useProjekt((x) => x.projekt);
  const filter = useTagging((x) => x.filter);
  const gewaehlt = useSchnitt((x) => x.gewaehlterClipId);
  const inPunkt = useSchnitt((x) => x.inPunkt);
  const outPunkt = useSchnitt((x) => x.outPunkt);
  const art = useProgramm((g) => g.art);
  const editorClipId = useProgramm((g) => g.clipId);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [umbenenne, setUmbenenne] = useState<string | null>(null);
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
  const fps = projekt.quellen[0]?.fps ?? 25;

  return (
    <section aria-label={t.clips.titel}>
      {(inPunkt !== null || outPunkt !== null) && (
        <div className={s.zeile} data-testid="neuer-clip">
          <p className="kicker">{t.clips.punkte}</p>
          <p className="hinweis">
            I: {inPunkt !== null ? formatZeit(inPunkt, fps) : '–'} · O:{' '}
            {outPunkt !== null ? formatZeit(outPunkt, fps) : '–'}
          </p>
          <div className={s.reihe}>
            <button
              className="primaer"
              disabled={inPunkt === null || outPunkt === null}
              onClick={() => {
                setMeldung(speichereClipAusPunkten() ? null : t.clips.zuKurz);
              }}
            >
              {t.clips.speichern}
            </button>
            <button onClick={() => useSchnitt.getState().loeschePunkte()}>
              {t.clips.verwerfen}
            </button>
          </div>
          <p className="hinweis">{t.clips.punkteHinweis}</p>
        </div>
      )}
      {meldung && (
        <p className={s.fehler} role="alert">
          {meldung}
        </p>
      )}
      {art === 'clip' && editorClipId && <ClipEditor clipId={editorClipId} />}

      <p className="kicker" style={{ marginTop: 12 }}>
        {t.clips.titel} · <span className="hinweis">{clips.length}</span>
      </p>
      {clips.length === 0 && <p className="hinweis">{t.clips.leer}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="clipliste">
        {clips.map((c) => {
          const q = projekt.quellen.find((x) => x.id === c.quelleId);
          const tag = c.tagId ? projekt.tags.find((x) => x.id === c.tagId) : undefined;
          const def = tag && projekt.tagDefinitionen.find((d) => d.id === tag.defId);
          const team = tag && projekt.teams.find((x) => x.id === tag.teamId);
          const sp = team?.kader.find((x) => x.id === tag?.spielerId);
          const offen = gewaehlt === c.id;
          return (
            <li key={c.id} className={`${s.zeile} ${offen ? s.aktiv : ''}`}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ClipVorschau clip={c} quelle={q} />
                <button
                  className={s.klick}
                  title={t.clips.abspielen}
                  onClick={() => {
                    useSchnitt.getState().waehleClip(offen ? null : c.id);
                    if (art !== 'quelle') useProgramm.getState().zurQuelle();
                    if (q && q.id !== projekt.aktiveQuelleId)
                      useProjekt.getState().aendereStill((p) => {
                        p.aktiveQuelleId = q.id;
                      });
                    usePlayer.getState().suche(c.in);
                  }}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}
                >
                  {umbenenne === c.id ? null : (
                    <strong style={{ color: 'var(--bd-ink)' }}>{c.name}</strong>
                  )}
                  <span className="hinweis">
                    {formatZeit(c.in, q?.fps ?? 25)} – {formatZeit(c.out, q?.fps ?? 25)} ·{' '}
                    {t.clips.dauer} {clipDauer(c).toFixed(1)} s
                  </span>
                </button>
              </div>
              {(def || team) && (
                <div className="hinweis">
                  {def ? t.clips.aus(def.name) : ''}
                  {team ? ` · ${team.kuerzel}${sp ? ` #${sp.nummer}` : ''}` : ''}
                </div>
              )}
              {c.freezeFrames.length + c.zeitlupen.length > 0 && (
                <div className="hinweis">
                  {c.freezeFrames.length > 0 &&
                    `${c.freezeFrames.length}× ${t.clipEditor.standbild}`}
                  {c.freezeFrames.length > 0 && c.zeitlupen.length > 0 && ' · '}
                  {c.zeitlupen.length > 0 && `${c.zeitlupen.length}× ${t.clipEditor.zeitlupe}`}
                </div>
              )}
              {(offen || umbenenne === c.id) && (
                <div className={s.reihe}>
                  <input
                    type="text"
                    aria-label={t.clips.umbenennen}
                    value={c.name}
                    onFocus={() => setUmbenenne(c.id)}
                    onBlur={() => setUmbenenne(null)}
                    onChange={(e) =>
                      useProjekt.getState().aendere('Clip umbenennen', (p) => {
                        const x = p.clips.find((y) => y.id === c.id);
                        if (x) x.name = e.target.value;
                      })
                    }
                    style={{ flex: 1, minWidth: 100 }}
                  />
                </div>
              )}
              {offen && (
                <div className={s.reihe}>
                  <button
                    className={`${s.mini} primaer`}
                    onClick={() => {
                      useProgramm.getState().oeffneClip(c.id);
                      useUi.getState().setzeTab('clips');
                    }}
                  >
                    {t.clips.bearbeiten}
                  </button>
                  <button
                    className={s.mini}
                    onClick={() => {
                      let name = '';
                      useProjekt.getState().aendere('Clip duplizieren', (p) => {
                        const id = dupliziereClip(p, c.id, t.clips.kopie);
                        name = p.clips.find((x) => x.id === id)?.name ?? '';
                      });
                      setMeldung(null);
                      void name;
                    }}
                  >
                    {t.clips.duplizieren}
                  </button>
                  <button
                    className={s.mini}
                    onClick={() => {
                      let pn = '';
                      useProjekt.getState().aendere('Clip in Playlist', (p) => {
                        const pl = sichereAktivePlaylist(p);
                        pl.eintraege.push(neuerClipEintrag(c.id));
                        pn = pl.name;
                      });
                      setMeldung(null);
                      setUmbenenne(null);
                      useUi.getState().setzeTab('playlist');
                      void pn;
                    }}
                  >
                    {t.clips.inPlaylist}
                  </button>
                  <button
                    className={`${s.mini} gefahr`}
                    onClick={() => {
                      if (!window.confirm(t.clips.loeschenFrage(c.name))) return;
                      if (art === 'clip' && editorClipId === c.id)
                        useProgramm.getState().zurQuelle();
                      useSchnitt.getState().waehleClip(null);
                      useProjekt.getState().aendere('Clip löschen', (p) => {
                        const tg = c.tagId;
                        entferneClip(p, c.id);
                        if (tg) p.tags = p.tags.filter((x) => x.id !== tg);
                      });
                    }}
                  >
                    {t.clips.loeschen}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
