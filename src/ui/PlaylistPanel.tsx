import { useState } from 'react';
import { t } from '../i18n/de-CH';
import { neueId } from '../model/schema';
import type { Playlist, PlaylistEintrag } from '../model/typen';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import {
  aktivePlaylist,
  dupliziereClipListe,
  neueTitelfolie,
  sichereAktivePlaylist,
  verschiebeEintrag,
} from '../schnitt/schnittLogik';
import { playlistZeitplan } from '../wiedergabe/zeitachse';
import { formatZeit } from '../video/bildmathe';
import s from './Seitenleiste.module.css';

/** Playlists: mehrere pro Projekt, Einträge per Drag & Drop (oder Pfeiltasten) ordnen, Titelfolien, Übergänge, Vorschau. */
export function PlaylistPanel() {
  const projekt = useProjekt((x) => x.projekt);
  const programm = useProgramm();
  const [zieh, setZieh] = useState<number | null>(null);
  const [ueber, setUeber] = useState<number | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  if (!projekt) return null;
  const pl = aktivePlaylist(projekt);
  const plan = pl ? playlistZeitplan(pl, projekt.clips) : null;
  const fps = projekt.quellen[0]?.fps ?? 25;
  const aendere = (name: string, fn: (p: Playlist) => void) =>
    useProjekt.getState().aendere(name, (d) => {
      const x = d.playlisten.find((y) => y.id === d.aktivePlaylistId) ?? d.playlisten[0];
      if (x) fn(x);
    });
  const bearbeiteEintrag = (id: string, fn: (e: PlaylistEintrag) => void) =>
    aendere('Playlist-Eintrag', (x) => {
      const e = x.eintraege.find((y) => y.id === id);
      if (e) fn(e);
    });
  const spieleAb = (start: number, abspielen: boolean) => {
    if (pl) programm.oeffnePlaylist(pl.id, { abspielen, start });
  };

  return (
    <section aria-label={t.playlist.titel}>
      <div className={s.reihe}>
        <select
          aria-label={t.playlist.aktiv}
          value={pl?.id ?? ''}
          onChange={(e) => {
            useProjekt.getState().aendere('Playlist wechseln', (d) => {
              d.aktivePlaylistId = e.target.value;
            });
            if (programm.art === 'playlist') programm.zurQuelle();
          }}
          style={{ flex: 1, minWidth: 120 }}
        >
          {projekt.playlisten.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
          {projekt.playlisten.length === 0 && <option value="">–</option>}
        </select>
        <button
          className={`${s.mini} primaer`}
          onClick={() => {
            const name = window
              .prompt(t.playlist.neuerName, `Playlist ${projekt.playlisten.length + 1}`)
              ?.trim();
            if (!name) return;
            useProjekt.getState().aendere('Neue Playlist', (d) => {
              const id = neueId();
              d.playlisten.push({ id, name, eintraege: [] });
              d.aktivePlaylistId = id;
            });
          }}
        >
          {t.playlist.neu}
        </button>
      </div>
      {!pl && <p className="hinweis">{t.playlist.leer}</p>}
      {pl && (
        <>
          <div className={s.reihe}>
            <button
              className={s.mini}
              onClick={() => {
                const n = window.prompt(t.playlist.neuerName, pl.name)?.trim();
                if (n) aendere('Playlist umbenennen', (x) => void (x.name = n));
              }}
            >
              {t.playlist.umbenennen}
            </button>
            <button
              className={s.mini}
              onClick={() =>
                useProjekt.getState().aendere('Playlist duplizieren', (d) => {
                  const id = dupliziereClipListe(d, pl.id);
                  if (id) d.aktivePlaylistId = id;
                })
              }
            >
              {t.playlist.duplizieren}
            </button>
            <button
              className={`${s.mini} gefahr`}
              onClick={() => {
                if (!window.confirm(t.playlist.loeschenFrage(pl.name))) return;
                if (programm.art === 'playlist') programm.zurQuelle();
                useProjekt.getState().aendere('Playlist löschen', (d) => {
                  d.playlisten = d.playlisten.filter((x) => x.id !== pl.id);
                  d.aktivePlaylistId = d.playlisten[0]?.id;
                });
              }}
            >
              {t.playlist.loeschen}
            </button>
          </div>
          <div className={s.reihe}>
            <button
              className="primaer"
              data-testid="playlist-abspielen"
              disabled={!plan || plan.dauer === 0}
              onClick={() => spieleAb(0, true)}
            >
              {t.playlist.abspielen}
            </button>
            {programm.art === 'playlist' && (
              <button onClick={() => programm.zurQuelle()}>{t.playlist.stopp}</button>
            )}
            {plan && (
              <span className="hinweis">{t.playlist.dauer(formatZeit(plan.dauer, fps))}</span>
            )}
          </div>

          {pl.eintraege.length === 0 && <p className="hinweis">{t.playlist.leerEintraege}</p>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="playlist-eintraege">
            {pl.eintraege.map((e, i) => {
              const clip =
                e.typ === 'clip' ? projekt.clips.find((c) => c.id === e.clipId) : undefined;
              const ez = plan?.eintraege.find((x) => x.index === i);
              const aufgeklappt = offen === e.id;
              return (
                <li
                  key={e.id}
                  className={s.zeile}
                  draggable
                  data-testid="playlist-eintrag"
                  onDragStart={(ev) => {
                    setZieh(i);
                    ev.dataTransfer.effectAllowed = 'move';
                    ev.dataTransfer.setData('text/plain', String(i));
                  }}
                  onDragOver={(ev) => {
                    ev.preventDefault();
                    setUeber(i);
                  }}
                  onDragEnd={() => {
                    setZieh(null);
                    setUeber(null);
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    if (zieh !== null)
                      aendere('Playlist ordnen', (x) => verschiebeEintrag(x, zieh, i));
                    setZieh(null);
                    setUeber(null);
                  }}
                  style={{
                    borderTop:
                      ueber === i && zieh !== null && zieh !== i
                        ? '2px solid var(--bd-gold)'
                        : undefined,
                    opacity: zieh === i ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="hinweis" aria-hidden="true" style={{ cursor: 'grab' }}>
                      ⠿
                    </span>
                    <button
                      className={s.klick}
                      onClick={() => setOffen(aufgeklappt ? null : e.id)}
                      aria-expanded={aufgeklappt}
                      style={{ flex: 1 }}
                    >
                      <span className="hinweis" style={{ minWidth: 18 }}>
                        {i + 1}
                      </span>
                      <strong
                        style={{ color: e.typ === 'titel' ? 'var(--bd-gold)' : 'var(--bd-ink)' }}
                      >
                        {e.typ === 'titel'
                          ? e.titel || '(Titel)'
                          : (clip?.name ?? t.playlist.clipFehlt)}
                      </strong>
                      <span className="hinweis">{ez ? `${ez.dauer.toFixed(1)} s` : ''}</span>
                    </button>
                    <button
                      className={s.mini}
                      aria-label={t.playlist.nachOben}
                      disabled={i === 0}
                      onClick={() =>
                        aendere('Playlist ordnen', (x) => verschiebeEintrag(x, i, i - 1))
                      }
                    >
                      ↑
                    </button>
                    <button
                      className={s.mini}
                      aria-label={t.playlist.nachUnten}
                      disabled={i === pl.eintraege.length - 1}
                      onClick={() =>
                        aendere('Playlist ordnen', (x) => verschiebeEintrag(x, i, i + 1))
                      }
                    >
                      ↓
                    </button>
                  </div>
                  {aufgeklappt && (
                    <div>
                      {e.typ === 'titel' && (
                        <div className={s.raster}>
                          <label style={{ gridColumn: '1 / -1' }}>
                            {t.playlist.kicker}
                            <input
                              type="text"
                              value={e.kicker}
                              onChange={(ev) =>
                                bearbeiteEintrag(
                                  e.id,
                                  (x) => x.typ === 'titel' && void (x.kicker = ev.target.value),
                                )
                              }
                            />
                          </label>
                          <label style={{ gridColumn: '1 / -1' }}>
                            {t.playlist.titelLabel}
                            <input
                              type="text"
                              value={e.titel}
                              onChange={(ev) =>
                                bearbeiteEintrag(
                                  e.id,
                                  (x) => x.typ === 'titel' && void (x.titel = ev.target.value),
                                )
                              }
                            />
                          </label>
                          <label style={{ gridColumn: '1 / -1' }}>
                            {t.playlist.untertitel}
                            <input
                              type="text"
                              value={e.untertitel}
                              onChange={(ev) =>
                                bearbeiteEintrag(
                                  e.id,
                                  (x) => x.typ === 'titel' && void (x.untertitel = ev.target.value),
                                )
                              }
                            />
                          </label>
                          <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={e.logo !== false}
                              data-testid="titel-logo"
                              onChange={(ev) =>
                                bearbeiteEintrag(
                                  e.id,
                                  (x) => x.typ === 'titel' && void (x.logo = ev.target.checked),
                                )
                              }
                            />{' '}
                            {t.overlay.titelfolieLogo}
                          </label>
                          <label>
                            {t.playlist.dauerLabel}
                            <input
                              type="text"
                              inputMode="decimal"
                              defaultValue={e.dauer}
                              key={e.dauer}
                              onBlur={(ev) => {
                                const n = Number(ev.target.value.replace(',', '.'));
                                if (n >= 0.5 && n <= 60)
                                  bearbeiteEintrag(
                                    e.id,
                                    (x) => x.typ === 'titel' && void (x.dauer = n),
                                  );
                                else ev.target.value = String(e.dauer);
                              }}
                            />
                          </label>
                        </div>
                      )}
                      <div className={s.reihe}>
                        <label className="hinweis">
                          {t.playlist.uebergang}{' '}
                          <select
                            aria-label={`${t.playlist.uebergang} ${i + 1}`}
                            value={e.uebergang}
                            onChange={(ev) =>
                              bearbeiteEintrag(
                                e.id,
                                (x) => void (x.uebergang = ev.target.value as 'schnitt' | 'blende'),
                              )
                            }
                          >
                            <option value="schnitt">{t.playlist.schnitt}</option>
                            <option value="blende">{t.playlist.blende}</option>
                          </select>
                        </label>
                        {ez && (
                          <button
                            className={s.mini}
                            onClick={() => spieleAb(ez.start, e.typ === 'clip')}
                          >
                            {e.typ === 'titel' ? t.playlist.vorschau : t.playlist.hierAbspielen}
                          </button>
                        )}
                        <button
                          className={`${s.mini} gefahr`}
                          onClick={() =>
                            aendere(
                              'Playlist-Eintrag entfernen',
                              (x) => void (x.eintraege = x.eintraege.filter((y) => y.id !== e.id)),
                            )
                          }
                        >
                          {t.playlist.entfernen}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className={s.reihe}>
        <button
          data-testid="titelfolie-neu"
          onClick={() => {
            const neu = neueTitelfolie();
            useProjekt
              .getState()
              .aendere('Titelfolie', (d) => void sichereAktivePlaylist(d).eintraege.push(neu));
            setOffen(neu.id);
          }}
        >
          {t.playlist.titelfolie}
        </button>
      </div>
    </section>
  );
}
