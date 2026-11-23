import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Quelle } from '../model/typen';
import { useDateien } from '../store/dateien';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { formatZeit, frameZuZeit, TEMPI, zeitZuFrame } from '../video/bildmathe';
import { renderFrame } from '../render/renderFrame';
import { ProxyDialog } from './ProxyDialog';
import s from './Buehne.module.css';

export function Buehne({ quelle }: { quelle: Quelle | undefined }) {
  const url = useDateien((d) => (quelle ? d.urls[quelle.id] : undefined));
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [groesse, setGroesse] = useState({ w: 0, h: 0 });
  const [proxyOffen, setProxyOffen] = useState(false);
  const { zeit, spielt, tempo, fehler } = usePlayer();

  // Grösse des Videorahmens (contain) bestimmen
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !quelle) return;
    const ar = quelle.breite / quelle.hoehe;
    const rechne = () => {
      const { clientWidth: cw, clientHeight: ch } = host;
      const w = Math.min(cw, ch * ar);
      setGroesse({ w: Math.floor(w), h: Math.floor(w / ar) });
    };
    rechne();
    const ro = new ResizeObserver(rechne);
    ro.observe(host);
    return () => ro.disconnect();
  }, [quelle]);

  // Video-Ereignisse → Player-Store, Render-Gerüst
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !quelle) return;
    const p = usePlayer.getState();
    p.setFehler(null);
    const zeichne = (t: number) => {
      const ctx = c.getContext('2d');
      if (ctx)
        renderFrame(t, useProjekt.getState().projekt, {
          ctx,
          breite: c.width,
          hoehe: c.height,
          modus: 'vorschau',
        });
    };
    let rvfc = 0;
    const schleife: VideoFrameRequestCallback = (_now, meta) => {
      usePlayer.getState().setZeit(meta.mediaTime);
      zeichne(meta.mediaTime);
      rvfc = v.requestVideoFrameCallback(schleife);
    };
    rvfc = v.requestVideoFrameCallback(schleife);
    const onSeek = () => {
      usePlayer.getState().setZeit(v.currentTime);
      zeichne(v.currentTime);
    };
    const onPlay = () => usePlayer.getState().setSpielt(true);
    const onPause = () => usePlayer.getState().setSpielt(false);
    const onErr = () => usePlayer.getState().setFehler(t.player.nichtAbspielbar);
    const onMeta = () => {
      const pos = useProjekt.getState().projekt?.positionen[quelle.id] ?? 0;
      v.currentTime = Math.min(pos, Math.max(0, v.duration - 0.1));
    };
    v.addEventListener('seeked', onSeek);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onErr);
    v.addEventListener('loadedmetadata', onMeta);
    usePlayer.getState().registriereSuche((tt) => {
      v.currentTime = tt;
      usePlayer.getState().setZeit(tt);
    });
    // Position alle 2 s und beim Pausieren im Projekt merken (ohne Undo-Eintrag)
    const merke = () =>
      useProjekt.getState().aendereStill((pr) => {
        pr.positionen[quelle.id] = Math.round(v.currentTime * 100) / 100;
      });
    const iv = window.setInterval(() => {
      if (!v.paused) merke();
    }, 2000);
    v.addEventListener('pause', merke);
    return () => {
      v.cancelVideoFrameCallback(rvfc);
      window.clearInterval(iv);
      v.removeEventListener('seeked', onSeek);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('pause', merke);
      v.removeEventListener('error', onErr);
      v.removeEventListener('loadedmetadata', onMeta);
    };
  }, [quelle, url]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = tempo;
  }, [tempo, url]);

  if (!quelle)
    return (
      <div className={s.host}>
        <p className={s.leer}>{t.player.keinVideo}</p>
      </div>
    );

  const fps = quelle.fps;
  const suche = usePlayer.getState().suche;
  const springe = (d: number) => suche(Math.min(Math.max(0, zeit + d), quelle.dauer));
  const bild = (n: number) => {
    videoRef.current?.pause();
    suche(
      frameZuZeit(
        Math.min(Math.max(0, zeitZuFrame(zeit, fps) + n), Math.ceil(quelle.dauer * fps) - 1),
        fps,
      ),
    );
  };
  const toggle = () => {
    const v = videoRef.current;
    if (v) {
      if (v.paused) void v.play();
      else v.pause();
    }
  };

  return (
    <>
      <div ref={hostRef} className={s.host}>
        {!url ? (
          <p className={s.leer}>
            {t.import.fehlt}: {quelle.dateiname}
          </p>
        ) : (
          <div className={s.rahmen} style={{ width: groesse.w, height: groesse.h }}>
            <video
              ref={videoRef}
              src={url}
              playsInline
              preload="auto"
              muted={false}
              data-testid="video"
            />
            <canvas
              ref={canvasRef}
              width={Math.min(1920, quelle.breite)}
              height={Math.round((Math.min(1920, quelle.breite) * quelle.hoehe) / quelle.breite)}
              data-testid="overlay"
            />
          </div>
        )}
        {fehler && (
          <div
            role="alert"
            className={s.leer}
            style={{ position: 'absolute', background: 'var(--bd-scrim)' }}
          >
            <p>{fehler}</p>
            <button className="primaer" onClick={() => setProxyOffen(true)}>
              {t.proxy.titel}
            </button>
          </div>
        )}
      </div>
      <div className={s.leiste} role="toolbar">
        <span className={s.gruppe}>
          <button onClick={() => springe(-10)} title={t.player.zurueck10}>
            −10 s
          </button>
          <button onClick={() => springe(-2)} title={t.player.zurueck2}>
            −2 s
          </button>
          <button
            onClick={() => bild(-1)}
            title={t.player.bildZurueck}
            aria-label={t.player.bildZurueck}
          >
            ◀|
          </button>
          <button
            className="primaer"
            onClick={toggle}
            aria-label={spielt ? t.player.pause : t.player.abspielen}
            data-testid="play"
          >
            {spielt ? '❚❚' : '▶'}
          </button>
          <button onClick={() => bild(1)} title={t.player.bildVor} aria-label={t.player.bildVor}>
            |▶
          </button>
          <button onClick={() => springe(2)} title={t.player.vor2}>
            +2 s
          </button>
          <button onClick={() => springe(10)} title={t.player.vor10}>
            +10 s
          </button>
        </span>
        <label className="hinweis">
          {t.player.tempo}{' '}
          <select
            value={tempo}
            onChange={(e) => usePlayer.getState().setTempo(Number(e.target.value))}
            aria-label={t.player.tempo}
          >
            {TEMPI.map((x) => (
              <option key={x} value={x}>
                {x}×
              </option>
            ))}
          </select>
        </label>
        <span className={s.zeit} data-testid="zeit">
          {formatZeit(zeit, fps)} / {formatZeit(quelle.dauer, fps)}
        </span>
      </div>
      {proxyOffen && <ProxyDialog quelle={quelle} onZu={() => setProxyOffen(false)} />}
    </>
  );
}
