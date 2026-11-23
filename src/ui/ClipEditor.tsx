import { useState } from 'react';
import type { Clip } from '../model/typen';
import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { useProgramm } from '../store/programm';
import {
  fuegeStandbildHinzu,
  fuegeZeitlupeHinzu,
  STANDARD_STANDBILD_DAUER,
  ZEITLUPE_TEMPI,
} from '../schnitt/schnittLogik';
import { ZeichnungenPanel } from './ZeichnungenPanel';
import { SpielerPanel } from './SpielerPanel';
import { TonPanel } from './TonPanel';
import { fuegeAusblendenHinzu, ausblendenVon, type OverlayArt } from '../overlay/ausblenden';
import { usePlayer } from '../store/player';
import { mitZeichnungsAbgleich } from '../zeichnen/logik';
import { nudgeClip } from '../schnitt/aktionen';
import { clipDauer } from '../wiedergabe/zeitachse';
import { aktuelleQuellPosition } from '../wiedergabe/transport';
import { formatZeit } from '../video/bildmathe';
import s from './Seitenleiste.module.css';

/** Clip-Editor: Name, Trimmen auf das Bild genau, Standbilder und Zeitlupe. Die Zeitleiste unten zeigt nur diesen Clip. */
export function ClipEditor({ clipId }: { clipId: string }) {
  const clip = useProjekt((x) => x.projekt?.clips.find((c) => c.id === clipId));
  const quelle = useProjekt((x) => x.projekt?.quellen.find((q) => q.id === clip?.quelleId));
  const [dauer, setDauer] = useState(String(STANDARD_STANDBILD_DAUER));
  const [laenge, setLaenge] = useState('2');
  const [tempo, setTempo] = useState<number>(0.5);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ausDauer, setAusDauer] = useState('3');
  if (!clip || !quelle) return null;
  const fps = quelle.fps;
  const zahl = (x: string) => Number(x.replace(',', '.'));
  const aendere = (name: string, fn: (c: Clip) => void) =>
    useProjekt.getState().aendere(name, (p) => {
      mitZeichnungsAbgleich(p, clipId, fn);
    });

  const standbild = () => {
    const pos = aktuelleQuellPosition();
    const d = zahl(dauer);
    if (!pos || pos.quelleId !== clip.quelleId) return setMeldung(t.clipEditor.keinePosition);
    if (!(d > 0)) return;
    setMeldung(null);
    aendere('Standbild einfügen', (c) => void fuegeStandbildHinzu(c, pos.quellZeit, d, fps));
  };
  const zeitlupe = () => {
    const pos = aktuelleQuellPosition();
    const l = zahl(laenge);
    if (!pos || pos.quelleId !== clip.quelleId || !(l > 0))
      return setMeldung(t.clipEditor.keinePosition);
    let ok = true;
    aendere('Zeitlupe einfügen', (c) => {
      ok = fuegeZeitlupeHinzu(c, pos.quellZeit, l, tempo, fps);
    });
    setMeldung(ok ? null : t.clipEditor.ueberlappt);
  };

  const blendeAus = (art: OverlayArt) => {
    const start = usePlayer.getState().zeit;
    const d = zahl(ausDauer);
    if (!(d > 0)) return;
    const gesamt = clipDauer(clip);
    aendere('Overlay ausblenden', (c) => {
      fuegeAusblendenHinzu(c, art, start, Math.min(gesamt, start + d));
    });
  };
  const rel = (z: number) => `${t.clipEditor.nach} ${(z - clip.in).toFixed(2)} s`;
  const stepper = (seite: 'in' | 'out') => (
    <span className={s.reihe} style={{ margin: 0 }}>
      <button
        className={s.mini}
        aria-label={`${seite === 'in' ? t.clipEditor.anfang : t.clipEditor.ende}: ${t.clipEditor.bildZurueck}`}
        onClick={() => nudgeClip(clipId, seite, -1)}
      >
        ◀|
      </button>
      <button
        className={s.mini}
        aria-label={`${seite === 'in' ? t.clipEditor.anfang : t.clipEditor.ende}: ${t.clipEditor.bildVor}`}
        onClick={() => nudgeClip(clipId, seite, 1)}
      >
        |▶
      </button>
    </span>
  );

  return (
    <section
      className={s.zeile}
      aria-label={t.clipEditor.titel}
      data-testid="clip-editor"
      style={{ borderTop: '2px solid var(--bd-gold)' }}
    >
      <div className={s.reihe}>
        <p className="kicker" style={{ margin: 0 }}>
          {t.clipEditor.titel}
        </p>
        <button
          className={s.mini}
          style={{ marginLeft: 'auto' }}
          onClick={() => useProgramm.getState().zurQuelle()}
        >
          {t.clipEditor.schliessen}
        </button>
      </div>
      <label className="hinweis">
        {t.clipEditor.name}
        <input
          type="text"
          value={clip.name}
          onChange={(e) =>
            aendere('Clip umbenennen', (c) => {
              c.name = e.target.value;
            })
          }
          style={{ width: '100%' }}
        />
      </label>
      <div className={s.reihe}>
        <span className="hinweis">
          {t.clipEditor.anfang}: {formatZeit(clip.in, fps)}
        </span>
        {stepper('in')}
        <span className="hinweis">
          {t.clipEditor.ende}: {formatZeit(clip.out, fps)}
        </span>
        {stepper('out')}
      </div>
      <p className="hinweis">
        {t.clipEditor.gesamt}: {clipDauer(clip).toFixed(2)} s
      </p>

      <p className="kicker">{t.clipEditor.standbild}</p>
      <div className={s.reihe}>
        <label className="hinweis">
          {t.clipEditor.standbildDauer}{' '}
          <input
            type="text"
            inputMode="decimal"
            value={dauer}
            onChange={(e) => setDauer(e.target.value)}
            style={{ width: 52 }}
            aria-label={t.clipEditor.standbildDauer}
          />
        </label>
        <button className="primaer" onClick={standbild} data-testid="standbild-einfuegen">
          {t.clipEditor.standbildEinfuegen}
        </button>
      </div>
      <ul
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
        aria-label={t.clipEditor.standbildListe}
      >
        {clip.freezeFrames.map((f, i) => (
          <li key={i} className={s.reihe} style={{ margin: 0 }}>
            <span className="hinweis" style={{ flex: 1 }}>
              {rel(f.zeit)} · {f.dauer} s
            </span>
            <button
              className={s.mini}
              onClick={() =>
                aendere('Standbild entfernen', (c) => void c.freezeFrames.splice(i, 1))
              }
            >
              {t.clipEditor.entfernen}
            </button>
          </li>
        ))}
      </ul>

      <p className="kicker">{t.clipEditor.zeitlupe}</p>
      <div className={s.reihe}>
        <label className="hinweis">
          {t.clipEditor.tempo}{' '}
          <select
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            aria-label={t.clipEditor.tempo}
          >
            {ZEITLUPE_TEMPI.map((x) => (
              <option key={x} value={x}>
                {x}×
              </option>
            ))}
          </select>
        </label>
        <label className="hinweis">
          {t.clipEditor.zeitlupeDauer}{' '}
          <input
            type="text"
            inputMode="decimal"
            value={laenge}
            onChange={(e) => setLaenge(e.target.value)}
            style={{ width: 52 }}
            aria-label={t.clipEditor.zeitlupeDauer}
          />
        </label>
        <button className="primaer" onClick={zeitlupe} data-testid="zeitlupe-einfuegen">
          {t.clipEditor.zeitlupeEinfuegen}
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {clip.zeitlupen.map((z, i) => (
          <li key={i} className={s.reihe} style={{ margin: 0 }}>
            <span className="hinweis" style={{ flex: 1 }}>
              {rel(z.von)} – {rel(z.bis)} · {z.tempo}×
            </span>
            <button
              className={s.mini}
              onClick={() => aendere('Zeitlupe entfernen', (c) => void c.zeitlupen.splice(i, 1))}
            >
              {t.clipEditor.entfernen}
            </button>
          </li>
        ))}
      </ul>
      {meldung && (
        <p className={s.fehler} role="alert">
          {meldung}
        </p>
      )}
      <p className="kicker">{t.overlay.clipTitel}</p>
      <div className={s.reihe}>
        <label className="hinweis">
          {t.overlay.abschnittDauer}{' '}
          <input
            type="text"
            inputMode="decimal"
            value={ausDauer}
            aria-label={t.overlay.abschnittDauer}
            onChange={(e) => setAusDauer(e.target.value)}
            style={{ width: 52 }}
          />
        </label>
        <button className={s.mini} data-testid="logo-aus" onClick={() => blendeAus('logo')}>
          {t.overlay.logoAus}
        </button>
        <button className={s.mini} data-testid="score-aus" onClick={() => blendeAus('scoreboard')}>
          {t.overlay.scoreboardAus}
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="ausblend-liste">
        {(['logo', 'scoreboard'] as const).flatMap((art) =>
          ausblendenVon(clip, art).map((ab, i) => (
            <li key={`${art}${i}`} className={s.reihe} style={{ margin: 0 }}>
              <span className="hinweis" style={{ flex: 1 }}>
                {art === 'logo' ? t.overlay.spurLogo : t.overlay.spurScore}: {ab.start.toFixed(1)}–
                {ab.ende.toFixed(1)} s
              </span>
              <button
                className={s.mini}
                onClick={() =>
                  aendere('Overlay einblenden', (c) => void c.ausblenden?.[art].splice(i, 1))
                }
              >
                {t.overlay.entfernen}
              </button>
            </li>
          )),
        )}
      </ul>
      <TonPanel clipId={clipId} />
      <ZeichnungenPanel clipId={clipId} />
      <SpielerPanel clipId={clipId} />
    </section>
  );
}
