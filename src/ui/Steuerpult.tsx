import { useEffect, useRef } from 'react';
import { zeichneAktuellesBild } from '../export/png';
import { t } from '../i18n/de-CH';
import { aktuellerEintragIndex } from '../praesentation/navigation';
import { beamerVollbild, beendePraesentation, naechsterEintrag } from '../praesentation/aktionen';
import { eintragTitel } from '../praesentation/titel';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useUi } from '../store/ui';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { toggleWiedergabe } from '../wiedergabe/transport';
import { formatKurz } from '../video/bildmathe';
import { AudioAusgabe } from './AudioAusgabe';
import { LiveStift } from './LiveStift';
import s from './Steuerpult.module.css';

const FARBEN = ['#e53935', '#BA990E', '#ffffff', '#2F80ED'];

/**
 * Steuerpult der Präsentation auf dem zweiten Bildschirm: Das Hauptfenster zeigt ein Spiegelbild des Beamer-Fensters
 * (hier wird live gezeichnet), die Playlist mit aktuellem Eintrag und die Steuerung. Das Video selbst liegt im Beamer-Fenster.
 */
export function Steuerpult() {
  const projekt = useProjekt((x) => x.projekt);
  const g = useProgramm();
  const zeit = usePlayer((p) => p.zeit);
  const spielt = usePlayer((p) => p.spielt);
  const stift = useUi((u) => u.liveStift);
  const farbe = useUi((u) => u.liveFarbe);
  const spiegel = useRef<HTMLCanvasElement>(null);

  const plan = baueProgrammPlan(projekt, g.art, g.clipId, g.playlistId);
  const idx = plan ? aktuellerEintragIndex(plan.eintraege, zeit) : 0;
  const quelle = projekt?.quellen.find(
    (q) => q.id === (g.anzeigeQuelleId ?? projekt.quellen[0]?.id),
  );
  const breite = 960;
  const hoehe = quelle ? Math.round((breite * quelle.hoehe) / quelle.breite) : 540;

  // Spiegelbild: dasselbe Bild wie im Beamer-Fenster, aus denselben Videoelementen und `renderFrame`
  useEffect(() => {
    let raf = 0;
    const takt = () => {
      const c = spiegel.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) zeichneAktuellesBild(ctx, c.width, c.height);
      raf = requestAnimationFrame(takt);
    };
    raf = requestAnimationFrame(takt);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={s.pult}
      data-testid="steuerpult"
      role="region"
      aria-label={t.praesentation.steuerpult}
    >
      <div className={s.bild}>
        <p className="kicker">{t.praesentation.spiegel}</p>
        <div className={s.spiegel} style={{ aspectRatio: `${breite} / ${hoehe}` }}>
          <canvas
            ref={spiegel}
            width={breite}
            height={hoehe}
            data-testid="spiegel"
            className={s.canvas}
          />
          <LiveStift />
        </div>
        <div className={s.leiste} role="toolbar" aria-label={t.praesentation.titel}>
          <button aria-label={t.praesentation.zurueck} onClick={() => naechsterEintrag(-1)}>
            ⏮
          </button>
          <button
            className="primaer"
            aria-label={spielt ? t.player.pause : t.player.abspielen}
            onClick={toggleWiedergabe}
          >
            {spielt ? '❚❚' : '▶'}
          </button>
          <button
            aria-label={t.praesentation.weiter}
            data-testid="praesentation-weiter"
            onClick={() => naechsterEintrag(1)}
          >
            ⏭
          </button>
          <span className={s.trenner} />
          <button
            aria-pressed={stift}
            data-testid="live-stift-schalter"
            onClick={() => useUi.getState().setzeLiveStift(!stift)}
          >
            ✎ {t.praesentation.stift}
          </button>
          {FARBEN.map((f) => (
            <button
              key={f}
              className={s.farbe}
              style={{ background: f }}
              aria-label={`${t.zeichnen.farbe} ${f}`}
              aria-pressed={farbe === f}
              onClick={() => useUi.getState().setzeLiveFarbe(f)}
            />
          ))}
          <button data-testid="live-loeschen" onClick={() => useUi.getState().loescheLive()}>
            {t.praesentation.loeschen}
          </button>
        </div>
      </div>

      <div className={s.seite}>
        <p className="kicker">{t.praesentation.liste}</p>
        <p className="hinweis" data-testid="praesentation-eintrag">
          {idx + 1} / {plan?.eintraege.length ?? 0} · {formatKurz(zeit)}
        </p>
        <ol className={s.liste} data-testid="steuerpult-liste">
          {plan?.eintraege.map((e, i) => (
            <li key={e.eintrag.id} data-aktuell={i === idx}>
              <button
                className={s.eintrag}
                aria-current={i === idx}
                onClick={() => usePlayer.getState().suche(e.start)}
              >
                <span className="hinweis">{i + 1}</span>
                <strong>{eintragTitel(projekt, e.eintrag)}</strong>
                <span className="hinweis">{e.dauer.toFixed(1)} s</span>
              </button>
            </li>
          ))}
        </ol>
        <AudioAusgabe />
        <p className="hinweis">{t.praesentation.vollbildHinweis}</p>
        <div className={s.leiste}>
          <button data-testid="beamer-vollbild" onClick={beamerVollbild}>
            {t.praesentation.beamerVollbild}
          </button>
          <button className="gefahr" data-testid="praesentation-ende" onClick={beendePraesentation}>
            {t.praesentation.beenden}
          </button>
        </div>
      </div>
    </div>
  );
}
