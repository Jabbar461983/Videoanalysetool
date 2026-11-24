import { useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { formatBytes } from '../db/speicher';
import { useProjekt } from '../store/projektStore';
import {
  ladeLetztenOrdner,
  listeVideos,
  ordnerErlaubt,
  speichereOrdner,
  waehleOrdner,
  type OrdnerVideo,
} from '../video/ordnerImport';

type Eintrag = { datei: File; handle?: FileSystemFileHandle };

/** Dialog «Aus Ordner importieren»: Videos eines Ordners auflisten und gewählte hinzufügen. */
export function OrdnerImportDialog({
  onHinzufuegen,
  onZu,
}: {
  onHinzufuegen: (e: Eintrag[]) => Promise<void>;
  onZu: () => void;
}) {
  const quellen = useProjekt((x) => x.projekt?.quellen ?? []);
  const [ordner, setOrdner] = useState<FileSystemDirectoryHandle | null>(null);
  const [braucheZugriff, setBraucheZugriff] = useState(false);
  const [videos, setVideos] = useState<OrdnerVideo[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const bereitsDa = (v: OrdnerVideo) =>
    quellen.some((q) => q.dateiname === v.name && q.groesse === v.groesse);

  const lade = async (h: FileSystemDirectoryHandle) => {
    setFehler(null);
    try {
      const liste = await listeVideos(h);
      setVideos(liste);
      setGewaehlt(
        new Set(
          liste
            .filter((v) => !bereitsDa(v))
            .slice(0, 1)
            .map((v) => v.name),
        ),
      );
    } catch {
      setFehler(t.ordner.lesefehler);
      setVideos(null);
    }
  };

  useEffect(() => {
    void (async () => {
      const h = await ladeLetztenOrdner();
      if (!h) return;
      setOrdner(h);
      if (await ordnerErlaubt(h, false)) await lade(h);
      else setBraucheZugriff(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const waehlen = async () => {
    const h = await waehleOrdner();
    if (!h) return;
    setOrdner(h);
    setBraucheZugriff(false);
    await speichereOrdner(h).catch(() => undefined);
    await lade(h);
  };
  const erlauben = async () => {
    if (ordner && (await ordnerErlaubt(ordner, true))) {
      setBraucheZugriff(false);
      await lade(ordner);
    } else setFehler(t.ordner.zugriffAbgelehnt);
  };
  const hinzufuegen = async () => {
    if (!videos) return;
    setLaeuft(true);
    try {
      const gew = videos.filter((v) => gewaehlt.has(v.name));
      const eintraege: Eintrag[] = [];
      for (const v of gew) eintraege.push({ datei: await v.handle.getFile(), handle: v.handle });
      await onHinzufuegen(eintraege);
      onZu();
    } catch {
      setFehler(t.ordner.lesefehler);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.ordner.titel}
      data-testid="ordner-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        zIndex: 88,
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <strong className="kicker">{t.ordner.titel}</strong>
          <span style={{ flex: 1 }} />
          <button onClick={onZu}>{t.ordner.schliessen}</button>
        </div>
        <p className="hinweis">{t.ordner.erklaerung}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
          <button className="primaer" data-testid="ordner-waehlen" onClick={() => void waehlen()}>
            {ordner ? t.ordner.anderer : t.ordner.waehlen}
          </button>
          {braucheZugriff && ordner && (
            <button data-testid="ordner-erlauben" onClick={() => void erlauben()}>
              {t.ordner.erlauben(ordner.name)}
            </button>
          )}
        </div>
        {ordner && !braucheZugriff && (
          <p className="hinweis">
            {t.ordner.ordner}: <strong style={{ color: 'var(--bd-ink)' }}>{ordner.name}</strong>
          </p>
        )}
        {fehler && (
          <p role="alert" style={{ color: 'var(--bd-gold)' }}>
            {fehler}
          </p>
        )}
        {videos && videos.length === 0 && <p className="hinweis">{t.ordner.keineVideos}</p>}
        {videos && videos.length > 0 && (
          <>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="ordner-liste">
              {videos.map((v) => (
                <li
                  key={v.name}
                  style={{ borderTop: '1px solid var(--bd-rule)', padding: '6px 0' }}
                >
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={gewaehlt.has(v.name)}
                      data-testid="ordner-video"
                      onChange={(e) => {
                        const n = new Set(gewaehlt);
                        if (e.target.checked) n.add(v.name);
                        else n.delete(v.name);
                        setGewaehlt(n);
                      }}
                    />
                    <span style={{ flex: 1, wordBreak: 'break-all' }}>{v.name}</span>
                    <span className="hinweis">
                      {formatBytes(v.groesse)} · {new Date(v.geaendert).toLocaleDateString('de-CH')}
                      {bereitsDa(v) ? ` · ${t.ordner.bereitsDa}` : ''}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button
                className="primaer"
                data-testid="ordner-hinzufuegen"
                disabled={gewaehlt.size === 0 || laeuft}
                onClick={() => void hinzufuegen()}
              >
                {laeuft ? t.import.liest : t.ordner.hinzufuegen(gewaehlt.size)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
