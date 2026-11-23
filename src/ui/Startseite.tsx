import { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { db } from '../db/db';
import {
  benenneUm,
  dupliziere,
  erstelleProjekt,
  listeProjekte,
  loescheProjekt,
  speichereProjekt,
} from '../db/projekte';
import {
  bitteUmDauerhaftenSpeicher,
  formatBytes,
  speicherInfo,
  type SpeicherInfo,
} from '../db/speicher';
import { raeumeAudioAuf } from '../audio/speicher';
import { warSauberBeendet } from '../store/autosave';
import type { Projekt } from '../model/typen';
import { Streifen } from './Streifen';
import s from './Startseite.module.css';

export const oeffneProjekt = (id: string) => {
  window.location.hash = `#/p/${encodeURIComponent(id)}`;
};

export function Startseite() {
  const [liste, setListe] = useState<Projekt[] | null>(null);
  const [rettung, setRettung] = useState<Projekt[]>([]);
  const [sp, setSp] = useState<SpeicherInfo | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const lade = useCallback(async () => {
    try {
      const l = await listeProjekte();
      setListe(l);
      if (!warSauberBeendet()) {
        const rows = await db.wiederherstellung.toArray();
        setRettung(
          rows
            .filter((r) => {
              const o = l.find((p) => p.id === r.projektId);
              return !o || r.projekt.geaendertAm > o.geaendertAm;
            })
            .map((r) => r.projekt),
        );
      }
      setSp(await speicherInfo());
      void raeumeAudioAuf(); // verwaiste Aufnahmen entfernen
    } catch {
      setFehler(t.fehler.db);
    }
  }, []);

  useEffect(() => {
    void lade();
    void bitteUmDauerhaftenSpeicher().then(async () => setSp(await speicherInfo()));
  }, [lade]);

  const neu = async () => {
    const p = await erstelleProjekt(t.start.standardName);
    oeffneProjekt(p.id);
  };
  const umbenennen = async (p: Projekt) => {
    const n = window.prompt(t.start.neuerName, p.name)?.trim();
    if (n) {
      await benenneUm(p.id, n);
      await lade();
    }
  };
  const duplizieren = async (p: Projekt) => {
    await dupliziere(p.id, t.start.kopieSuffix);
    await lade();
  };
  const loeschen = async (p: Projekt) => {
    if (window.confirm(t.start.loeschenFrage(p.name))) {
      await loescheProjekt(p.id);
      await lade();
    }
  };
  const stelleWiederHer = async (p: Projekt) => {
    await speichereProjekt(p);
    setRettung((r) => r.filter((x) => x.id !== p.id));
    await lade();
  };

  return (
    <main className={s.seite}>
      <div className={s.kopf}>
        <Streifen />
        <span className="kicker">{t.app.kicker}</span>
      </div>
      <p className="kicker" style={{ margin: 0 }}>
        {t.start.kicker}
      </p>
      <h1 className={s.titel}>{t.start.titel}</h1>
      {fehler && <p role="alert">{fehler}</p>}
      {rettung.length > 0 && (
        <section className={s.box}>
          <p>{t.start.wiederherstellenHinweis}</p>
          {rettung.map((p) => (
            <button key={p.id} className="primaer" onClick={() => void stelleWiederHer(p)}>
              {t.start.wiederherstellen}: {p.name}
            </button>
          ))}
        </section>
      )}
      <div className={s.aktionen}>
        <button className="primaer" onClick={() => void neu()}>
          {t.start.neu}
        </button>
      </div>
      {liste && liste.length === 0 && <p className="hinweis">{t.start.leer}</p>}
      <ul className={s.liste}>
        {liste?.map((p) => (
          <li key={p.id} className={s.zeile}>
            <button className={s.name} onClick={() => oeffneProjekt(p.id)}>
              {p.name}
            </button>
            <span className={s.meta}>
              {t.start.geaendert}: {new Date(p.geaendertAm).toLocaleString('de-CH')}
            </span>
            <button onClick={() => oeffneProjekt(p.id)}>{t.start.oeffnen}</button>
            <button onClick={() => void umbenennen(p)}>{t.start.umbenennen}</button>
            <button onClick={() => void duplizieren(p)}>{t.start.duplizieren}</button>
            <button className="gefahr" onClick={() => void loeschen(p)}>
              {t.start.loeschen}
            </button>
          </li>
        ))}
      </ul>
      {sp && (
        <p className={`hinweis ${s.speicher}`}>
          {t.start.speicher(formatBytes(sp.genutzt), formatBytes(sp.gesamt))} ·{' '}
          {sp.dauerhaft ? t.start.speicherDauerhaft : t.start.speicherNichtDauerhaft}
        </p>
      )}
    </main>
  );
}
