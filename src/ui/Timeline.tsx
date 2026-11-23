import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Quelle } from '../model/typen';
import { useDateien } from '../store/dateien';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useTagging } from '../store/tagging';
import { erzeugeVorschauen } from '../video/thumbs';
import { formatKurz, formatZeit, vorschauZeiten } from '../video/bildmathe';
import s from './Timeline.module.css';

const ZOOM_MAX = 64;

export function Timeline({
  quelle,
  schluessel,
}: {
  quelle: Quelle | undefined;
  schluessel: string;
}) {
  const zeit = usePlayer((p) => p.zeit);
  const tags = useProjekt((x) => x.projekt?.tags);
  const defs = useProjekt((x) => x.projekt?.tagDefinitionen);
  const gewaehlt = useTagging((x) => x.ausgewaehltTagId);
  const datei = useDateien((d) => (quelle ? d.dateien[quelle.id] : undefined));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [bilder, setBilder] = useState<Map<number, string>>(new Map());
  const [status, setStatus] = useState<'laeuft' | 'fertig' | 'fehler'>('laeuft');

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(el.clientWidth));
    ro.observe(el);
    setBreite(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const dauer = quelle?.dauer ?? 0;
  const gesamt = Math.max(1, breite * zoom);
  const pps = dauer > 0 ? gesamt / dauer : 1;

  // Vorschaubilder im Worker erzeugen (gecacht in IndexedDB)
  useEffect(() => {
    if (!quelle || !datei) {
      setBilder(new Map());
      return;
    }
    let weg = false;
    let abbruch: (() => void) | null = null;
    const urls: string[] = [];
    setBilder(new Map());
    setStatus('laeuft');
    void erzeugeVorschauen(schluessel, datei, quelle.dauer, (z, blob) => {
      if (weg) return;
      const u = URL.createObjectURL(blob);
      urls.push(u);
      setBilder((m) => new Map(m).set(Math.round(z * 1000), u));
    })
      .then((h) => {
        abbruch = h.abbrechen;
        void h.fertig.then((ok) => {
          if (!weg) setStatus(ok ? 'fertig' : 'fehler');
        });
      })
      .catch(() => {
        if (!weg) setStatus('fehler');
      });
    return () => {
      weg = true;
      abbruch?.();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [quelle, datei, schluessel]);

  // Beim Abspielen mitscrollen
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1) return;
    const x = zeit * pps;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40)
      el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
  }, [zeit, pps, zoom]);

  const zeiten = useMemo(() => vorschauZeiten(dauer), [dauer]);
  const sprung = (clientX: number) => {
    const el = scrollRef.current;
    if (!el || !quelle) return;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft;
    usePlayer.getState().suche(Math.min(Math.max(0, x / pps), quelle.dauer));
  };
  const zoomen = (f: number) => {
    const el = scrollRef.current;
    const mitteZeit = el ? (el.scrollLeft + el.clientWidth / 2) / pps : 0;
    const neu = Math.min(ZOOM_MAX, Math.max(1, zoom * f));
    setZoom(neu);
    requestAnimationFrame(() => {
      if (el)
        el.scrollLeft = mitteZeit * ((breite * neu) / Math.max(dauer, 1)) - el.clientWidth / 2;
    });
  };

  const tickAbstand = [1, 2, 5, 10, 30, 60, 120, 300, 600, 1800].find((x) => x * pps >= 90) ?? 3600;
  const ticks: number[] = [];
  for (let x = 0; x <= dauer; x += tickAbstand) ticks.push(x);

  return (
    <div className={s.wrap}>
      <div className={s.bar}>
        <span className="kicker">{t.timeline.spurVideo}</span>
        <button onClick={() => zoomen(1 / 2)} aria-label={t.timeline.zoomRaus}>
          −
        </button>
        <span className="hinweis" aria-label={t.timeline.zoom}>
          {Math.round(zoom * 100)} %
        </span>
        <button onClick={() => zoomen(2)} aria-label={t.timeline.zoomRein}>
          +
        </button>
        {status === 'laeuft' && datei && (
          <span className="hinweis">{t.timeline.vorschauLaeuft}</span>
        )}
        {status === 'fehler' && <span className="hinweis">{t.timeline.vorschauFehlt}</span>}
      </div>
      <div
        ref={scrollRef}
        className={s.scroll}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            zoomen(e.deltaY < 0 ? 1.25 : 0.8);
          }
        }}
      >
        <div
          className={s.spur}
          data-testid="timeline"
          style={{ width: gesamt }}
          role="slider"
          aria-label={t.timeline.spurVideo}
          aria-valuemin={0}
          aria-valuemax={Math.round(dauer)}
          aria-valuenow={Math.round(zeit)}
          aria-valuetext={quelle ? formatZeit(zeit, quelle.fps) : ''}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            sprung(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) sprung(e.clientX);
          }}
        >
          <div className={s.lineal}>
            {ticks.map((x) => (
              <span key={x} className={s.tick} style={{ left: x * pps }}>
                {formatKurz(x)}
              </span>
            ))}
          </div>
          <div className={s.bilder} style={{ width: gesamt }}>
            {zeiten.map((z) => {
              const u = bilder.get(Math.round(z * 1000));
              const w = gesamt / zeiten.length;
              return u ? (
                <img key={z} src={u} alt="" style={{ width: w }} draggable={false} />
              ) : (
                <span key={z} style={{ width: w, flex: 'none' }} />
              );
            })}
          </div>
          <div className={s.tagSpur} data-testid="tagspur">
            <span className={s.tagSpurLabel}>{t.seite.tags}</span>
            {quelle &&
              tags
                ?.filter((tg) => tg.quelleId === quelle.id)
                .map((tg) => {
                  const d = defs?.find((x) => x.id === tg.defId);
                  return (
                    <button
                      key={tg.id}
                      className={s.marke}
                      data-testid="tagmarke"
                      aria-current={gewaehlt === tg.id}
                      aria-label={`${d?.name ?? ''} ${formatZeit(tg.zeit, quelle.fps)}`}
                      title={`${d?.name ?? ''} ${formatZeit(tg.zeit, quelle.fps)}`}
                      style={{ left: tg.zeit * pps, background: d?.farbe }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        useTagging.getState().waehleTag(tg.id);
                        usePlayer.getState().suche(tg.zeit);
                      }}
                    />
                  );
                })}
          </div>
          <div className={s.kopf} style={{ left: zeit * pps }} data-testid="playhead" />
        </div>
      </div>
    </div>
  );
}
