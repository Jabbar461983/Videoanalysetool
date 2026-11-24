import { useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { formatBytes } from '../db/speicher';
import { LinkImportFehler, ladeVideoVonLink, pruefeLink } from '../video/linkImport';

type Eintrag = { datei: File; handle?: FileSystemFileHandle };

/** «Videolink einfügen»: direkte Videolinks werden aufs Gerät geladen, YouTube-Links erklären den erlaubten Weg. */
export function LinkImport({ onDatei }: { onDatei: (e: Eintrag) => Promise<void> }) {
  const [text, setText] = useState('');
  const [youtube, setYoutube] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState<{ geladen: number; gesamt: number | null } | null>(null);
  const abbruch = useRef<AbortController | null>(null);

  const laden = async () => {
    setFehler(null);
    setYoutube(null);
    const p = pruefeLink(text);
    if (p.art === 'leer') return;
    if (p.art === 'ungueltig') {
      setFehler(t.link.ungueltig[p.grund]);
      return;
    }
    if (p.art === 'youtube') {
      setYoutube(p.videoId ?? '');
      return;
    }
    const ac = new AbortController();
    abbruch.current = ac;
    setLaedt({ geladen: 0, gesamt: null });
    try {
      const r = await ladeVideoVonLink(p.url, {
        signal: ac.signal,
        beiFortschritt: (geladen, gesamt) => setLaedt({ geladen, gesamt }),
      });
      setLaedt(null);
      await onDatei(r);
      setText('');
    } catch (e) {
      setLaedt(null);
      if (e instanceof LinkImportFehler) {
        if (e.art !== 'abgebrochen')
          setFehler(`${t.link.fehler[e.art]}${e.detail ? ` (${e.detail})` : ''}`);
      } else setFehler(t.link.fehler.netz);
    } finally {
      abbruch.current = null;
    }
  };

  return (
    <div style={{ margin: '12px 0' }} data-testid="link-import">
      <p className="kicker">{t.link.titel}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          inputMode="url"
          aria-label={t.link.feld}
          placeholder={t.link.platzhalter}
          value={text}
          data-testid="link-eingabe"
          disabled={!!laedt}
          style={{ flex: 1, minWidth: 0 }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void laden();
          }}
        />
        {laedt ? (
          <button data-testid="link-abbrechen" onClick={() => abbruch.current?.abort()}>
            {t.link.abbrechen}
          </button>
        ) : (
          <button
            className="primaer"
            data-testid="link-laden"
            disabled={!text.trim()}
            onClick={() => void laden()}
          >
            {t.link.laden}
          </button>
        )}
      </div>
      {laedt && (
        <div role="status" data-testid="link-fortschritt" style={{ marginTop: 6 }}>
          <progress
            max={laedt.gesamt ?? undefined}
            value={laedt.gesamt ? laedt.geladen : undefined}
            style={{ width: '100%' }}
          />
          <span className="hinweis">
            {formatBytes(laedt.geladen)}
            {laedt.gesamt ? ` / ${formatBytes(laedt.gesamt)}` : ''}
          </span>
        </div>
      )}
      {fehler && (
        <p role="alert" data-testid="link-fehler" style={{ color: 'var(--bd-gold)' }}>
          {fehler}
        </p>
      )}
      {youtube !== null && (
        <div
          role="note"
          data-testid="link-youtube"
          style={{ border: '1px solid var(--bd-gold)', padding: 10, marginTop: 8 }}
        >
          <strong style={{ color: 'var(--bd-ink)' }}>{t.link.youtubeTitel}</strong>
          <p className="hinweis">{t.link.youtubeText}</p>
          <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
            {t.link.youtubeSchritte.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="hinweis">{t.link.youtubeHinweis}</p>
          <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">
            {t.link.studioOeffnen}
          </a>
        </div>
      )}
    </div>
  );
}
