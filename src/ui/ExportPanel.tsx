import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { exportiereBdva } from '../projektdatei/bdva';
import {
  ladeHerunter,
  ExportFehler,
  DIREKT_SPEICHERN_AB_BYTES,
  exportiereVideo,
  pruefeExport,
  waehleZieldatei,
  type ExportPhase,
  type Vorabpruefung,
} from '../export/exportieren';
import { dateiName, formatDauer, type ExportAufloesung } from '../export/format';
import { exportiereAktuellesBild } from '../export/png';
import { useDateien } from '../store/dateien';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useSchnitt } from '../store/schnitt';
import { aktivePlaylist } from '../schnitt/schnittLogik';
import s from './Seitenleiste.module.css';

const MB = 1024 * 1024;

/** Export-Reiter: MP4 (Clip oder Playlist), PNG des aktuellen Bilds, Projektdatei. */
export function ExportPanel() {
  const projekt = useProjekt((x) => x.projekt);
  const gewaehlt = useSchnitt((x) => x.gewaehlterClipId);
  const programmClip = useProgramm((g) => g.clipId);
  const dateien = useDateien((d) => d.dateien);
  const [art, setArt] = useState<'clip' | 'playlist'>('playlist');
  const [clipId, setClipId] = useState<string>('');
  const [pruefung, setPruefung] = useState<Vorabpruefung | null>(null);
  const [phase, setPhase] = useState<ExportPhase | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const abbruch = useRef<AbortController | null>(null);

  const pl = projekt ? aktivePlaylist(projekt) : undefined;
  const effClip = clipId || programmClip || gewaehlt || projekt?.clips[0]?.id || '';
  const zielId = art === 'clip' ? effClip : (pl?.id ?? '');
  const aufloesung: ExportAufloesung = projekt?.einstellungen.exportAufloesung ?? 1080;

  useEffect(() => {
    let weg = false;
    setPruefung(null);
    if (!zielId) return;
    void pruefeExport({ art, id: zielId }, aufloesung).then((p) => {
      if (!weg) setPruefung(p);
    });
    return () => {
      weg = true;
    };
  }, [art, zielId, aufloesung, dateien, projekt]);

  if (!projekt) return null;

  const starte = async () => {
    if (!zielId || !pruefung || laeuft) return;
    setMeldung(null);
    let datei: FileSystemFileHandle | null = null;
    if (pruefung.geschaetzteBytes > DIREKT_SPEICHERN_AB_BYTES) {
      try {
        datei = await waehleZieldatei(pruefung.name); // grosse Exporte direkt in eine Datei schreiben
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    const ac = new AbortController();
    abbruch.current = ac;
    setLaeuft(true);
    setPhase({ phase: 'vorbereitung', bild: 0, gesamt: 0, verstrichenSek: 0, restSek: null });
    try {
      const r = await exportiereVideo({
        ziel: { art, id: zielId },
        aufloesung,
        onPhase: setPhase,
        signal: ac.signal,
        datei,
      });
      setMeldung({
        art: 'ok',
        text: `${r.ort === 'datei' ? t.export.gespeichert : t.export.heruntergeladen}: ${r.dateiname} (${(r.bytes / MB).toFixed(1)} MB)`,
      });
    } catch (e) {
      const m = e instanceof ExportFehler ? e.message : t.export.fehlerAllgemein;
      setMeldung(
        m === 'abgebrochen'
          ? { art: 'fehler', text: t.export.abgebrochen }
          : { art: 'fehler', text: m },
      );
    } finally {
      setLaeuft(false);
      setPhase(null);
      abbruch.current = null;
    }
  };

  const langsam =
    phase?.phase === 'video' && pruefung && phase.verstrichenSek > 4 && phase.bild > 0
      ? phase.bild / phase.verstrichenSek < pruefung.fps * 0.5
      : false;
  const anteil = phase && phase.gesamt ? phase.bild / phase.gesamt : 0;

  return (
    <section aria-label={t.export.titel} data-testid="export-panel">
      <p className="kicker">{t.export.video}</p>
      <div className={s.reihe}>
        <label className="hinweis">
          <input
            type="radio"
            name="expart"
            checked={art === 'playlist'}
            onChange={() => setArt('playlist')}
            disabled={laeuft}
            data-testid="export-playlist"
          />{' '}
          {t.export.playlist}
        </label>
        <label className="hinweis">
          <input
            type="radio"
            name="expart"
            checked={art === 'clip'}
            onChange={() => setArt('clip')}
            disabled={laeuft}
            data-testid="export-clip"
          />{' '}
          {t.export.clip}
        </label>
      </div>
      {art === 'clip' ? (
        <select
          aria-label={t.export.clip}
          value={effClip}
          onChange={(e) => setClipId(e.target.value)}
          disabled={laeuft}
          style={{ width: '100%' }}
        >
          {projekt.clips.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="hinweis" style={{ margin: '4px 0' }}>
          {pl ? `${t.playlist.aktiv}: ${pl.name}` : t.export.keinePlaylist}
        </p>
      )}
      <div className={s.reihe}>
        <label className="hinweis">
          {t.export.aufloesung}{' '}
          <select
            value={aufloesung}
            aria-label={t.export.aufloesung}
            disabled={laeuft}
            onChange={(e) =>
              useProjekt.getState().aendereStill((p) => {
                p.einstellungen.exportAufloesung = Number(e.target.value) as ExportAufloesung;
              })
            }
          >
            <option value={1080}>1080p</option>
            <option value={720}>720p</option>
          </select>
        </label>
      </div>

      {pruefung && (
        <div className="hinweis" data-testid="export-info">
          {pruefung.breite}×{pruefung.hoehe} · {pruefung.fps} {t.meta.fps} ·{' '}
          {formatDauer(pruefung.dauer)} · ca. {(pruefung.geschaetzteBytes / MB).toFixed(0)} MB ·{' '}
          {pruefung.codecs.video === 'avc'
            ? 'H.264'
            : pruefung.codecs.video === 'vp9'
              ? 'VP9'
              : '–'}{' '}
          +{' '}
          {pruefung.codecs.audio === 'aac'
            ? 'AAC'
            : pruefung.codecs.audio === 'opus'
              ? 'Opus'
              : t.export.ohneTon}
          {pruefung.codecs.hinweise.map((h) => (
            <p key={h} className={s.fehler} style={{ margin: '4px 0' }}>
              {h}
            </p>
          ))}
          {pruefung.fehlendeQuellen.length > 0 && (
            <p className={s.fehler} role="alert" style={{ margin: '4px 0' }}>
              {t.export.dateiFehlt(pruefung.fehlendeQuellen.join(', '))}
            </p>
          )}
        </div>
      )}
      {!pruefung && zielId && <p className="hinweis">{t.export.leerOderLaedt}</p>}

      <div className={s.reihe}>
        {laeuft ? (
          <button
            className="gefahr"
            data-testid="export-abbrechen"
            onClick={() => abbruch.current?.abort()}
          >
            {t.export.abbrechen}
          </button>
        ) : (
          <button
            className="primaer"
            data-testid="export-start"
            disabled={!pruefung || pruefung.fehlendeQuellen.length > 0 || !pruefung.codecs.video}
            onClick={() => void starte()}
          >
            {t.export.starten}
          </button>
        )}
      </div>
      {phase && (
        <div role="status" data-testid="export-fortschritt">
          <progress
            value={phase.phase === 'video' ? anteil : undefined}
            max={1}
            style={{ width: '100%' }}
          />
          <p className="hinweis" style={{ margin: 0 }}>
            {phase.phase === 'vorbereitung' && t.export.phaseVorbereitung}
            {phase.phase === 'ton' && t.export.phaseTon}
            {phase.phase === 'video' &&
              `${t.export.phaseVideo(phase.bild, phase.gesamt, Math.round(anteil * 100))}${phase.restSek !== null ? ` · ${t.export.rest(formatDauer(phase.restSek))}` : ''}`}
          </p>
          {langsam && pruefung && (
            <p className={s.fehler}>
              {t.export.langsam(
                formatDauer((phase.verstrichenSek / Math.max(phase.bild, 1)) * phase.gesamt),
              )}
            </p>
          )}
        </div>
      )}
      {meldung && (
        <p
          className={meldung.art === 'fehler' ? s.fehler : 'hinweis'}
          role={meldung.art === 'fehler' ? 'alert' : 'status'}
          data-testid="export-meldung"
        >
          {meldung.text}
        </p>
      )}

      <p className="kicker" style={{ marginTop: 16 }}>
        {t.export.bild}
      </p>
      <div className={s.reihe}>
        <button
          data-testid="png-export"
          onClick={async () => {
            const name = await exportiereAktuellesBild();
            setMeldung(
              name
                ? { art: 'ok', text: `${t.export.heruntergeladen}: ${name}` }
                : { art: 'fehler', text: t.export.keinBild },
            );
          }}
        >
          {t.export.png}
        </button>
      </div>

      <p className="kicker" style={{ marginTop: 16 }}>
        {t.export.projektdatei}
      </p>
      <p className="hinweis">{t.export.projektdateiHinweis}</p>
      <div className={s.reihe}>
        <button
          data-testid="bdva-export"
          onClick={async () => {
            const blob = await exportiereBdva(projekt);
            ladeHerunter(blob, `${dateiName(projekt.name)}.bdva`);
            setMeldung({
              art: 'ok',
              text: `${t.export.heruntergeladen}: ${dateiName(projekt.name)}.bdva`,
            });
          }}
        >
          {t.export.bdvaSpeichern}
        </button>
      </div>
    </section>
  );
}
