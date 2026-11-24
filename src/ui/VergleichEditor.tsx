import { t } from '../i18n/de-CH';
import type { PlaylistEintrag, Projekt } from '../model/typen';
import { usePlayer } from '../store/player';
import {
  findeSegmentIndex,
  quellZeitZuClipZeit,
  vergleichSeitenZeit,
  type Zeitplan,
} from '../wiedergabe/zeitachse';
import s from './Seitenleiste.module.css';

type Vergleich = Extract<PlaylistEintrag, { typ: 'vergleich' }>;

/** Bearbeitung eines Vergleichs-Eintrags: Clips, Beschriftung, Ablauf, Abdunklung, Anker. */
export function VergleichEditor({
  e,
  index,
  projekt,
  plan,
  aendere,
  imPlayer,
}: {
  e: Vergleich;
  index: number;
  projekt: Projekt;
  plan: Zeitplan | null;
  aendere: (fn: (v: Vergleich) => void) => void;
  /** Läuft diese Playlist gerade im Player? (Anker lassen sich dann aus der Position übernehmen.) */
  imPlayer: boolean;
}) {
  const nummer = (n: number, min: number, max: number, fn: (v: Vergleich, x: number) => void) => ({
    type: 'text' as const,
    inputMode: 'decimal' as const,
    defaultValue: n,
    key: n,
    onBlur: (ev: React.FocusEvent<HTMLInputElement>) => {
      const x = Number(ev.target.value.replace(',', '.'));
      if (Number.isFinite(x) && x >= min && x <= max) aendere((v) => fn(v, x));
      else ev.target.value = String(n);
    },
  });

  const ankerAusPlayer = (seite: 'links' | 'rechts') => {
    if (!plan || !imPlayer) return;
    const tt = usePlayer.getState().zeit;
    const seg = plan.segmente[findeSegmentIndex(plan.segmente, tt)];
    if (!seg || seg.art !== 'vergleich' || seg.eintragIndex !== index) return;
    const clip = projekt.clips.find((c) => c.id === e[seite].clipId);
    if (!clip) return;
    const ct =
      Math.round(quellZeitZuClipZeit(clip, vergleichSeitenZeit(seg, seite, tt)) * 100) / 100;
    aendere((v) => void (v[seite].anker = ct));
  };

  const seite = (name: 'links' | 'rechts', titel: string) => (
    <fieldset style={{ border: '1px solid var(--bd-rule)', margin: 0, padding: 8, minWidth: 0 }}>
      <legend className="kicker">{titel}</legend>
      <label>
        {t.vergleich.clip}
        <select
          style={{ width: '100%' }}
          value={e[name].clipId}
          data-testid={`vergleich-clip-${name}`}
          onChange={(ev) =>
            aendere((v) => {
              v[name].clipId = ev.target.value;
              v[name].anker = 0;
            })
          }
        >
          {projekt.clips.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.vergleich.beschriftung}
        <input
          type="text"
          value={e[name].beschriftung}
          data-testid={`vergleich-text-${name}`}
          onChange={(ev) => aendere((v) => void (v[name].beschriftung = ev.target.value))}
        />
      </label>
      <label style={{ flexDirection: 'row', alignItems: 'center' }}>
        {t.vergleich.farbe}{' '}
        <input
          type="color"
          value={e[name].farbe}
          aria-label={t.vergleich.farbe}
          onChange={(ev) => aendere((v) => void (v[name].farbe = ev.target.value))}
        />
      </label>
      {(e.ablauf === 'gleichzeitig' || e.zugabe) && (
        <div className={s.reihe}>
          <label>
            {t.vergleich.anker}
            <input {...nummer(e[name].anker, 0, 600, (v, x) => void (v[name].anker = x))} />
          </label>
          <button
            className={s.mini}
            disabled={!imPlayer}
            title={t.vergleich.ankerHinweis}
            data-testid={`vergleich-anker-${name}`}
            onClick={() => ankerAusPlayer(name)}
          >
            {t.vergleich.ankerSetzen}
          </button>
        </div>
      )}
    </fieldset>
  );

  return (
    <div data-testid="vergleich-editor">
      <div className={s.raster}>
        {seite('links', t.vergleich.links)}
        {seite('rechts', t.vergleich.rechts)}
      </div>
      <div className={s.reihe}>
        <button
          className={s.mini}
          data-testid="vergleich-tauschen"
          onClick={() =>
            aendere((v) => {
              [v.links, v.rechts] = [v.rechts, v.links];
            })
          }
        >
          ⇄ {t.vergleich.tauschen}
        </button>
        <label className="hinweis">
          {t.vergleich.ablauf}{' '}
          <select
            value={e.ablauf}
            data-testid="vergleich-ablauf"
            onChange={(ev) =>
              aendere((v) => void (v.ablauf = ev.target.value as Vergleich['ablauf']))
            }
          >
            <option value="nacheinander">{t.vergleich.nacheinander}</option>
            <option value="gleichzeitig">{t.vergleich.gleichzeitig}</option>
          </select>
        </label>
        <label className="hinweis">
          {t.vergleich.darstellung}{' '}
          <select
            value={e.darstellung}
            onChange={(ev) =>
              aendere((v) => void (v.darstellung = ev.target.value as Vergleich['darstellung']))
            }
          >
            <option value="einpassen">{t.vergleich.einpassen}</option>
            <option value="fuellen">{t.vergleich.fuellen}</option>
          </select>
        </label>
      </div>
      {e.ablauf === 'nacheinander' && (
        <>
          <label style={{ flexDirection: 'row', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={e.zugabe}
              data-testid="vergleich-zugabe"
              onChange={(ev) => aendere((v) => void (v.zugabe = ev.target.checked))}
            />{' '}
            {t.vergleich.zugabe}
          </label>
          <div className={s.raster}>
            <label>
              {t.vergleich.pause}
              <input {...nummer(e.pause, 0, 10, (v, x) => void (v.pause = x))} />
            </label>
            <label>
              {t.vergleich.abdunklung}: {Math.round(e.abdunklung * 100)} %
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={Math.round(e.abdunklung * 100)}
                data-testid="vergleich-dim"
                onChange={(ev) =>
                  aendere((v) => void (v.abdunklung = Number(ev.target.value) / 100))
                }
              />
            </label>
          </div>
        </>
      )}
      <p className="hinweis">{t.vergleich.hinweisTon}</p>
    </div>
  );
}
