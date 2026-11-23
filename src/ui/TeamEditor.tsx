import { useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { istGueltigesKuerzel, normalisiereKuerzel } from '../tagging/kuerzel';
import { parseKaderCsv } from '../tagging/csv';
import {
  kaderAusVorlage,
  teamAusVorlage,
  type KaderVorlage,
  type TeamVorlage,
} from '../db/vorlagen';
import { neueId } from '../model/schema';
import type { Spieler, Team } from '../model/typen';
import { VorlagenLeiste } from './VorlagenLeiste';
import s from './Seitenleiste.module.css';

export function TeamEditor({ index }: { index: 0 | 1 }) {
  const team = useProjekt((x) => x.projekt?.teams[index]);
  const [nr, setNr] = useState('');
  const [name, setName] = useState('');
  const [pos, setPos] = useState<Spieler['position']>('stuermer');
  const [fehler, setFehler] = useState('');
  const [csvMeldung, setCsvMeldung] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const [kuerzelEntwurf, setKuerzelEntwurf] = useState<string | null>(null);
  if (!team) return null;
  const aendere = (n: string, fn: (tm: Team) => void) =>
    useProjekt.getState().aendere(n, (p) => fn(p.teams[index]));

  const hinzu = () => {
    const nummer = Number(nr);
    if (!/^\d{1,3}$/.test(nr)) return setFehler(t.setup.nummerFehler);
    if (team.kader.some((x) => x.nummer === nummer)) return setFehler(t.setup.nummerBelegt);
    aendere('Spieler hinzufügen', (tm) => {
      tm.kader.push({ id: neueId(), nummer, name: name.trim(), position: pos });
      tm.kader.sort((a, b) => a.nummer - b.nummer);
    });
    setNr('');
    setName('');
    setFehler('');
  };

  const csv = async (datei: File) => {
    const { spieler, fehler: f } = parseKaderCsv(await datei.text());
    if (spieler.length === 0 && f.length === 0) return;
    if (team.kader.length > 0 && !window.confirm(t.setup.csvErsetzen)) return;
    aendere('Kader aus CSV', (tm) => {
      tm.kader = spieler.sort((a, b) => a.nummer - b.nummer);
    });
    setCsvMeldung(t.setup.csvErgebnis(spieler.length, f.length));
  };

  const k = kuerzelEntwurf ?? team.kuerzel;
  return (
    <section
      className={s.abschnitt}
      style={index === 0 ? { marginTop: 0 } : undefined}
      aria-label={t.setup.team(index + 1)}
    >
      <p className="kicker">{t.setup.team(index + 1)}</p>
      <div className={s.raster}>
        <label>
          {t.setup.kuerzel}
          <input
            type="text"
            value={k}
            maxLength={3}
            aria-invalid={!istGueltigesKuerzel(k)}
            onChange={(e) => {
              const v = normalisiereKuerzel(e.target.value);
              setKuerzelEntwurf(v);
              if (istGueltigesKuerzel(v))
                aendere('Team-Kürzel', (tm) => {
                  tm.kuerzel = v;
                });
            }}
            onBlur={() => setKuerzelEntwurf(null)}
          />
          {!istGueltigesKuerzel(k) && <span className={s.fehler}>{t.setup.kuerzelFehler}</span>}
        </label>
        <label>
          {t.setup.farbe}
          <input
            type="color"
            value={team.farbe}
            onChange={(e) =>
              aendere('Teamfarbe', (tm) => {
                tm.farbe = e.target.value;
              })
            }
            style={{ minHeight: 44, width: '100%' }}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          {t.setup.name}
          <input
            type="text"
            value={team.name}
            onChange={(e) =>
              aendere('Teamname', (tm) => {
                tm.name = e.target.value;
              })
            }
          />
        </label>
      </div>
      <VorlagenLeiste
        typ="team"
        label={t.setup.vorlageTeam}
        vorschlag={`${team.kuerzel} – ${team.name}`}
        daten={() =>
          ({ kuerzel: team.kuerzel, name: team.name, farbe: team.farbe }) satisfies TeamVorlage
        }
        anwenden={(d) => aendere('Team-Vorlage', (tm) => teamAusVorlage(tm, d as TeamVorlage))}
      />

      <p className="kicker" style={{ marginTop: 12 }}>
        {t.setup.kader} · <span className="hinweis">{team.kader.length}</span>
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid={`kader-${index}`}>
        {team.kader.map((sp) => (
          <li
            key={sp.id}
            className={s.reihe}
            style={{ margin: 0, borderTop: '1px solid var(--bd-rule)' }}
          >
            <strong style={{ color: 'var(--bd-ink)', minWidth: 32 }}>#{sp.nummer}</strong>
            <span style={{ flex: 1 }}>{sp.name}</span>
            <span className="hinweis">{t.setup.pos[sp.position]}</span>
            <button
              className={s.mini}
              aria-label={`${t.setup.entfernen}: ${sp.name}`}
              onClick={() =>
                aendere('Spieler entfernen', (tm) => {
                  tm.kader = tm.kader.filter((x) => x.id !== sp.id);
                })
              }
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className={s.reihe}>
        <input
          type="text"
          inputMode="numeric"
          placeholder={t.setup.nummer}
          aria-label={t.setup.nummer}
          value={nr}
          onChange={(e) => setNr(e.target.value)}
          style={{ width: 64 }}
        />
        <input
          type="text"
          placeholder={t.setup.spielerName}
          aria-label={t.setup.spielerName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, minWidth: 90 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') hinzu();
          }}
        />
        <select
          aria-label={t.setup.position}
          value={pos}
          onChange={(e) => setPos(e.target.value as Spieler['position'])}
        >
          {(['verteidiger', 'stuermer', 'torhueter'] as const).map((p) => (
            <option key={p} value={p}>
              {t.setup.pos[p]}
            </option>
          ))}
        </select>
        <button className="primaer" onClick={hinzu}>
          {t.setup.hinzufuegen}
        </button>
      </div>
      {fehler && (
        <p className={s.fehler} role="alert">
          {fehler}
        </p>
      )}
      <div className={s.reihe}>
        <button className={s.mini} onClick={() => csvRef.current?.click()}>
          {t.setup.csvImport}
        </button>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          data-testid={`csv-${index}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void csv(f);
            e.target.value = '';
          }}
        />
        <span className="hinweis">{t.setup.csvHinweis}</span>
      </div>
      {csvMeldung && (
        <p className="hinweis" role="status">
          {csvMeldung}
        </p>
      )}
      <VorlagenLeiste
        typ="kader"
        label={t.setup.vorlageKader}
        vorschlag={`Kader ${team.kuerzel}`}
        daten={() => team.kader.map(({ id: _id, ...rest }) => rest) satisfies KaderVorlage}
        anwenden={(d) =>
          aendere('Kader-Vorlage', (tm) => {
            tm.kader = kaderAusVorlage(d as KaderVorlage);
          })
        }
      />
    </section>
  );
}
