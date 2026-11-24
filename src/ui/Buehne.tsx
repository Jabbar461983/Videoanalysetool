import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Quelle } from '../model/typen';
import { useDateien } from '../store/dateien';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { formatZeit, TEMPI } from '../video/bildmathe';
import { renderFrame, type RenderKontext } from '../render/renderFrame';
import {
  aktuelleDauer,
  aktuelleFps,
  aktuellerPlan,
  bildSchritt,
  springeRelativ,
  mixer,
  spieler,
  toggleWiedergabe,
} from '../wiedergabe/transport';
import { ProxyDialog } from './ProxyDialog';
import { oeffneZeichnenFuerPosition } from '../schnitt/aktionen';
import { Werkzeugleiste } from './Werkzeugleiste';
import { LiveStift } from './LiveStift';
import { useUi } from '../store/ui';
import { AufnahmeLeiste } from './AufnahmeLeiste';
import { useAufnahme } from '../store/aufnahme';
import { beiLogoGeladen, holeLogo } from '../render/logo';
import { ladeSpielerBilder, vorschauBilder } from '../render/spielerBilder';
import { schalteLogo, schalteScoreboard } from '../overlay/aktionen';
import { ZeichenEbene } from './ZeichenEbene';
import { SpielerEbene } from './SpielerEbene';
import { SpielerKreuze } from './SpielerKreuze';
import { TaktikKlickEbene } from './TaktikKlickEbene';
import { useZeichnen } from '../store/zeichnen';
import type { Zeichnung } from '../model/typen';
import s from './Buehne.module.css';

/** Entwurf und gerade bearbeitete Zeichnung für die Live-Vorschau (zeitunabhängig sichtbar). */
function zeichenVorschau(): { zusatz?: Zeichnung[]; ausblenden?: ReadonlySet<string> } {
  const { entwurf, ersatz } = useZeichnen.getState();
  const immer = (z: Zeichnung): Zeichnung => ({
    ...z,
    start: -1,
    ende: 1e9,
    animation: { ein: 'keine', dauerEin: 0, aus: 'keine', dauerAus: 0 },
  });
  const zusatz: Zeichnung[] = [];
  if (entwurf) zusatz.push(immer(entwurf));
  if (ersatz) zusatz.push(immer(ersatz));
  return zusatz.length ? { zusatz, ausblenden: ersatz ? new Set([ersatz.id]) : undefined } : {};
}

function kontextAus(): RenderKontext {
  const g = useProgramm.getState();
  if (g.art === 'clip' && g.clipId) return { art: 'clip', clipId: g.clipId };
  if (g.art === 'playlist' && g.playlistId) return { art: 'playlist', playlistId: g.playlistId };
  const p = useProjekt.getState().projekt;
  return { art: 'quelle', quelleId: p?.aktiveQuelleId ?? p?.quellen[0]?.id };
}

export function Buehne({ quelle }: { quelle: Quelle | undefined }) {
  const projekt = useProjekt((x) => x.projekt);
  const url = useDateien((d) => (quelle ? d.urls[quelle.id] : undefined));
  const art = useProgramm((g) => g.art);
  const clipId = useProgramm((g) => g.clipId);
  const playlistId = useProgramm((g) => g.playlistId);
  const anzeigeId = useProgramm((g) => g.anzeigeQuelleId);
  const progFehler = useProgramm((g) => g.fehler);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [groesse, setGroesse] = useState({ w: 0, h: 0 });
  const [proxyOffen, setProxyOffen] = useState(false);
  const { zeit, spielt, tempo, fehler } = usePlayer();
  const praesi = useUi((u) => u.praesentation);
  const aufnahmePhase = useAufnahme((a) => a.phase);
  const countdown = useAufnahme((a) => a.countdown);

  // Quelle, nach der die Bühne dimensioniert wird (im Programm: die des aktuellen Segments)
  const anzeige =
    art !== 'quelle' ? (projekt?.quellen.find((q) => q.id === anzeigeId) ?? quelle) : quelle;

  // Grösse des Videorahmens (contain) bestimmen
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !anzeige) return;
    const ar = anzeige.breite / anzeige.hoehe;
    const rechne = () => {
      const { clientWidth: cw, clientHeight: ch } = host;
      const w = Math.min(cw, ch * ar);
      setGroesse({ w: Math.floor(w), h: Math.floor(w / ar) });
    };
    rechne();
    const ro = new ResizeObserver(rechne);
    ro.observe(host);
    return () => ro.disconnect();
  }, [anzeige]);

  // Beide Video-Elemente beim Programmspieler anmelden
  useEffect(() => {
    const a = videoRef.current;
    const b = videoBRef.current;
    if (a && b) spieler.attach(a, b);
    return () => spieler.detach();
  }, [!quelle]); // eslint-disable-line react-hooks/exhaustive-deps

  const werkzeugModus = useZeichnen((z) => z.werkzeug);

  const zeichne = (tt: number) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx)
      renderFrame(tt, useProjekt.getState().projekt, {
        ctx,
        breite: c.width,
        hoehe: c.height,
        modus: 'vorschau',
        kontext: kontextAus(),
        logo: holeLogo(),
        bilder: vorschauBilder,
        ...zeichenVorschau(),
      });
  };

  // Bilder der Spieler-Objekte werden asynchron dekodiert: danach neu zeichnen
  const spielerObjekte = useProjekt((x) => x.projekt?.spielerObjekte);
  useEffect(() => {
    const p = useProjekt.getState().projekt;
    if (!p) return;
    let aktiv = true;
    void ladeSpielerBilder(p, vorschauBilder).then(() => {
      if (aktiv) zeichne(usePlayer.getState().zeit);
    });
    return () => {
      aktiv = false;
    };
  }, [spielerObjekte]);

  // Logo wird asynchron geladen: danach neu zeichnen
  useEffect(() => beiLogoGeladen(() => zeichne(usePlayer.getState().zeit)), []);

  // Quell-Modus: Video-Ereignisse → Player-Store, Render-Gerüst
  useEffect(() => {
    const v = videoRef.current;
    const vb = videoBRef.current;
    if (art !== 'quelle' || !v || !quelle) return;
    mixer.quellModus();
    usePlayer.getState().setFehler(null);
    // Anzeige: Element A sichtbar, B versteckt
    for (const el of [v, vb]) {
      if (!el) continue;
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.width = '';
      el.style.height = '';
      el.style.objectFit = '';
      el.muted = false;
    }
    v.style.opacity = '1';
    v.style.zIndex = '1';
    if (vb) {
      vb.pause();
      vb.style.opacity = '0';
      vb.style.zIndex = '0';
    }
    const merkePosition = () => {
      const pos = useProjekt.getState().projekt?.positionen[quelle.id] ?? 0;
      if (Number.isFinite(v.duration)) v.currentTime = Math.min(pos, Math.max(0, v.duration - 0.1));
    };
    if (url) {
      if (v.dataset.quelle !== quelle.id || v.dataset.url !== url) {
        v.dataset.quelle = quelle.id;
        v.dataset.url = url;
        v.src = url;
      } else merkePosition();
    } else {
      v.removeAttribute('src');
      delete v.dataset.quelle;
      delete v.dataset.url;
    }
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
    v.addEventListener('seeked', onSeek);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onErr);
    v.addEventListener('loadedmetadata', merkePosition);
    usePlayer.getState().registriereSuche((tt) => {
      v.currentTime = tt;
      usePlayer.getState().setZeit(tt);
    });
    usePlayer.getState().setSpielt(!v.paused);
    // Position alle 2 s und beim Pausieren im Projekt merken (ohne Undo-Eintrag)
    const merke = () =>
      useProjekt.getState().aendereStill((pr) => {
        pr.positionen[quelle.id] = Math.round(v.currentTime * 100) / 100;
      });
    const iv = window.setInterval(() => {
      if (!v.paused) merke();
    }, 2000);
    v.addEventListener('pause', merke);
    const unsub = useProjekt.subscribe(() => zeichne(v.currentTime));
    return () => {
      v.cancelVideoFrameCallback(rvfc);
      window.clearInterval(iv);
      unsub();
      v.removeEventListener('seeked', onSeek);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('pause', merke);
      v.removeEventListener('error', onErr);
      v.removeEventListener('loadedmetadata', merkePosition);
    };
  }, [art, quelle, url]);

  // Programm-Modus (Clip-Editor, Playlist): Programmspieler steuert beide Elemente
  useEffect(() => {
    if (art === 'quelle') return;
    const plan0 = aktuellerPlan();
    if (!plan0) return;
    if (videoRef.current && videoBRef.current) mixer.verbinde(videoRef.current, videoBRef.current);
    let letzterPlan = JSON.stringify(plan0.segmente);
    const tonSignatur = () =>
      JSON.stringify(useProjekt.getState().projekt?.clips.map((c) => c.audio) ?? []);
    let letzterTon = tonSignatur();
    const g = useProgramm.getState();
    const start = g.startZeit;
    const autoplay = g.autoplay;
    usePlayer.getState().registriereSuche((tt) => void spieler.springe(tt));
    void (async () => {
      await spieler.laden(plan0, start);
      zeichne(usePlayer.getState().zeit);
      if (autoplay) await spieler.abspielen();
    })();
    // Änderungen am Projekt (z. B. Freeze eingefügt) → Plan neu laden
    const unsubProjekt = useProjekt.subscribe(() => {
      const plan = aktuellerPlan();
      if (!plan) return;
      const j = JSON.stringify(plan.segmente);
      const ton = tonSignatur();
      if (ton !== letzterTon) {
        letzterTon = ton;
        if (spieler.laeuft) void mixer.spielt(usePlayer.getState().zeit);
      }
      if (j !== letzterPlan) {
        letzterPlan = j;
        void spieler.aktualisiere(plan).then(() => zeichne(usePlayer.getState().zeit));
      } else zeichne(usePlayer.getState().zeit);
    });
    const unsubZeit = usePlayer.subscribe((st, prev) => {
      if (st.zeit !== prev.zeit) zeichne(st.zeit);
    });
    const unsubZeichnen = useZeichnen.subscribe(() => zeichne(usePlayer.getState().zeit));
    return () => {
      unsubProjekt();
      unsubZeit();
      unsubZeichnen();
      spieler.pausiere();
    };
  }, [art, clipId, playlistId]);

  useEffect(() => {
    if (videoRef.current && art === 'quelle') videoRef.current.playbackRate = tempo;
  }, [tempo, url, art]);

  if (!quelle)
    return (
      <div className={s.host}>
        <p className={s.leer}>{t.player.keinVideo}</p>
      </div>
    );

  const fps = art === 'quelle' ? quelle.fps : aktuelleFps();
  const dauer = art === 'quelle' ? quelle.dauer : aktuelleDauer();
  const programmName =
    art === 'clip'
      ? projekt?.clips.find((c) => c.id === clipId)?.name
      : projekt?.playlisten.find((p) => p.id === playlistId)?.name;
  const verknuepft = art !== 'quelle' || !!url;

  return (
    <>
      {art !== 'quelle' && !praesi && (
        <div className={s.modus} data-testid="modus">
          <span className="kicker">{art === 'clip' ? t.programm.clip : t.programm.playlist}</span>
          <strong style={{ color: 'var(--bd-ink)' }}>{programmName}</strong>
          <button onClick={() => useProgramm.getState().zurQuelle()}>{t.programm.zurQuelle}</button>
        </div>
      )}
      {art === 'clip' && !praesi && <Werkzeugleiste />}
      <div ref={hostRef} className={s.host}>
        {!verknuepft && (
          <p className={s.leer}>
            {t.import.fehlt}: {quelle.dateiname}
          </p>
        )}
        <div
          className={s.rahmen}
          style={{
            width: groesse.w,
            height: groesse.h,
            visibility: verknuepft ? 'visible' : 'hidden',
          }}
        >
          <video ref={videoRef} playsInline preload="auto" data-testid="video" />
          <video ref={videoBRef} playsInline preload="auto" data-testid="video-b" />
          {anzeige && (
            <canvas
              ref={canvasRef}
              width={Math.min(1920, anzeige.breite)}
              height={Math.round((Math.min(1920, anzeige.breite) * anzeige.hoehe) / anzeige.breite)}
              data-testid="overlay"
              style={{ zIndex: 5 }}
            />
          )}
          {praesi && <LiveStift />}
          {art === 'clip' && anzeige && werkzeugModus === 'spieler' && <SpielerEbene />}
          {art === 'clip' && anzeige && !praesi && <SpielerKreuze />}
          {anzeige && !praesi && <TaktikKlickEbene />}
          {art === 'clip' && anzeige && werkzeugModus !== 'spieler' && (
            <ZeichenEbene
              breite={Math.min(1920, anzeige.breite)}
              hoehe={Math.round((Math.min(1920, anzeige.breite) * anzeige.hoehe) / anzeige.breite)}
            />
          )}
        </div>
        {aufnahmePhase === 'countdown' && (
          <div className={s.countdown} role="status" data-testid="countdown-overlay">
            {countdown}
          </div>
        )}
        {aufnahmePhase === 'laeuft' && (
          <div className={s.rec} data-testid="rec-anzeige">
            ● REC
          </div>
        )}
        {(fehler || progFehler) && (
          <div
            role="alert"
            className={s.leer}
            style={{ position: 'absolute', background: 'var(--bd-scrim)', zIndex: 6 }}
          >
            <p>{progFehler ?? fehler}</p>
            {!progFehler && (
              <button className="primaer" onClick={() => setProxyOffen(true)}>
                {t.proxy.titel}
              </button>
            )}
          </div>
        )}
      </div>
      {!praesi && (
        <div className={s.leiste} role="toolbar">
          <span className={s.gruppe}>
            <button onClick={() => springeRelativ(-10)} title={t.player.zurueck10}>
              −10 s
            </button>
            <button onClick={() => springeRelativ(-2)} title={t.player.zurueck2}>
              −2 s
            </button>
            <button
              onClick={() => bildSchritt(-1)}
              title={t.player.bildZurueck}
              aria-label={t.player.bildZurueck}
            >
              ◀|
            </button>
            <button
              className="primaer"
              onClick={toggleWiedergabe}
              aria-label={spielt ? t.player.pause : t.player.abspielen}
              data-testid="play"
            >
              {spielt ? '❚❚' : '▶'}
            </button>
            <button
              onClick={() => bildSchritt(1)}
              title={t.player.bildVor}
              aria-label={t.player.bildVor}
            >
              |▶
            </button>
            <button onClick={() => springeRelativ(2)} title={t.player.vor2}>
              +2 s
            </button>
            <button onClick={() => springeRelativ(10)} title={t.player.vor10}>
              +10 s
            </button>
          </span>
          {art === 'quelle' && (
            <button
              className="primaer"
              data-testid="zeichnen-starten"
              title={t.zeichnen.startenHinweis}
              onClick={(e) => {
                oeffneZeichnenFuerPosition();
                e.currentTarget.blur();
              }}
            >
              {t.zeichnen.starten}
            </button>
          )}
          {art === 'quelle' && (
            <button
              className="primaer"
              data-testid="vertonen-starten"
              title={t.ton.vertonenHinweis}
              onClick={(e) => {
                oeffneZeichnenFuerPosition();
                e.currentTarget.blur();
              }}
            >
              🎙 {t.ton.vertonen}
            </button>
          )}
          {art === 'quelle' && (
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
          )}
          <span className={s.gruppe}>
            <button
              aria-pressed={projekt?.einstellungen.logoAnzeigen ?? true}
              data-testid="logo-schalter"
              title={t.overlay.logoHinweis}
              onClick={(e) => {
                schalteLogo();
                e.currentTarget.blur();
              }}
            >
              {t.overlay.logo}
            </button>
            <button
              aria-pressed={projekt?.einstellungen.scoreboardAnzeigen ?? true}
              data-testid="scoreboard-schalter"
              title={t.overlay.scoreboardHinweis}
              onClick={(e) => {
                schalteScoreboard();
                e.currentTarget.blur();
              }}
            >
              {t.overlay.scoreboard}
            </button>
          </span>
          <span className={s.zeit} data-testid="zeit">
            {formatZeit(zeit, fps)} / {formatZeit(dauer, fps)}
          </span>
        </div>
      )}
      {art === 'clip' && clipId && !praesi && <AufnahmeLeiste clipId={clipId} />}
      {proxyOffen && <ProxyDialog quelle={quelle} onZu={() => setProxyOffen(false)} />}
    </>
  );
}
