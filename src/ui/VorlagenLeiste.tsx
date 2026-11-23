import { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { VorlageRow, VorlageTyp } from '../db/db';
import { listeVorlagen, loescheVorlage, markiereStandard, speichereVorlage } from '../db/vorlagen';
import s from './Seitenleiste.module.css';

/** Vorlagen speichern/laden/löschen für einen Typ; `daten` liefert den aktuellen Inhalt, `anwenden` übernimmt eine Vorlage. */
export function VorlagenLeiste({
  typ,
  label,
  daten,
  anwenden,
  vorschlag,
}: {
  typ: VorlageTyp;
  label: string;
  daten: () => unknown;
  anwenden: (d: unknown) => void;
  vorschlag?: string;
}) {
  const [liste, setListe] = useState<VorlageRow[]>([]);
  const [meldung, setMeldung] = useState('');
  const lade = useCallback(async () => setListe(await listeVorlagen(typ)), [typ]);
  useEffect(() => {
    void lade();
  }, [lade]);
  const std = liste.find((v) => v.standard);

  return (
    <div className={s.reihe} aria-label={label}>
      <button
        className={s.mini}
        onClick={async () => {
          const name = window.prompt(t.setup.vorlageName, vorschlag ?? '')?.trim();
          if (!name) return;
          const alsStandard = window.confirm(`${t.setup.vorlageStandard}?`);
          await speichereVorlage(typ, name, structuredClone(daten()), alsStandard);
          setMeldung(t.setup.vorlageGespeichert);
          await lade();
        }}
      >
        {t.setup.vorlageSpeichern}
      </button>
      {liste.length > 0 && (
        <>
          <select
            aria-label={`${label}: ${t.setup.vorlageLaden}`}
            value=""
            onChange={(e) => {
              const v = liste.find((x) => x.id === e.target.value);
              if (v) anwenden(structuredClone(v.daten));
            }}
          >
            <option value="">{t.setup.vorlageLaden}</option>
            {liste.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.standard ? ' ★' : ''}
              </option>
            ))}
          </select>
          <select
            aria-label={`${label}: ${t.setup.vorlageStandard}`}
            value={std?.id ?? ''}
            onChange={async (e) => {
              await markiereStandard(typ, e.target.value || null);
              await lade();
            }}
          >
            <option value="">{t.setup.vorlageStandard}: –</option>
            {liste.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            className={`${s.mini} gefahr`}
            onClick={async () => {
              const v = liste.find((x) => x.id === (std?.id ?? liste[0]?.id));
              const name = window.prompt(
                `${t.setup.vorlageLoeschen}: ${liste.map((x) => x.name).join(', ')}`,
                v?.name ?? '',
              );
              const ziel = liste.find((x) => x.name === name);
              if (ziel) {
                await loescheVorlage(ziel.id);
                await lade();
              }
            }}
          >
            {t.setup.vorlageLoeschen}
          </button>
        </>
      )}
      {meldung && (
        <span className="hinweis" role="status">
          {meldung}
        </span>
      )}
    </div>
  );
}
