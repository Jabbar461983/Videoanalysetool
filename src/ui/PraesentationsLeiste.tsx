import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { aktuellerEintragIndex } from '../praesentation/navigation';
import { beendePraesentation, naechsterEintrag } from '../praesentation/aktionen';
import { usePlayer } from '../store/player';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { useUi } from '../store/ui';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { toggleWiedergabe } from '../wiedergabe/transport';
import s from './PraesentationsLeiste.module.css';

const FARBEN = ['#e53935', '#BA990E', '#ffffff', '#2F80ED'];
const AUSBLENDEN_NACH_MS = 2500;

/** Steuerleiste der Präsentation: blendet sich nach 2.5 s ohne Bewegung aus. */
export function PraesentationsLeiste() {
  const projekt = useProjekt((x) => x.projekt);
  const g = useProgramm();
  const zeit = usePlayer((p) => p.zeit);
  const spielt = usePlayer((p) => p.spielt);
  const stift = useUi((u) => u.liveStift);
  const farbe = useUi((u) => u.liveFarbe);
  const [sichtbar, setSichtbar] = useState(true);
  const timer = useRef<number>(0);

  useEffect(() => {
    const zeigen = () => {
      setSichtbar(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSichtbar(false), AUSBLENDEN_NACH_MS);
    };
    zeigen();
    window.addEventListener('pointermove', zeigen);
    window.addEventListener('pointerdown', zeigen);
    window.addEventListener('keydown', zeigen);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('pointermove', zeigen);
      window.removeEventListener('pointerdown', zeigen);
      window.removeEventListener('keydown', zeigen);
    };
  }, []);

  const plan = baueProgrammPlan(projekt, g.art, g.clipId, g.playlistId);
  const idx = plan ? aktuellerEintragIndex(plan.eintraege, zeit) : 0;
  const e = plan?.eintraege[idx];
  const titel =
    e?.eintrag.typ === 'titel'
      ? e.eintrag.titel
      : (projekt?.clips.find((c) => e?.eintrag.typ === 'clip' && c.id === e.eintrag.clipId)?.name ??
        '');

  return (
    <div
      className={`${s.leiste} ${sichtbar ? '' : s.versteckt}`}
      role="toolbar"
      aria-label={t.praesentation.titel}
      data-testid="praesentationsleiste"
      data-sichtbar={sichtbar}
    >
      <span className={s.info} data-testid="praesentation-eintrag">
        {idx + 1} / {plan?.eintraege.length ?? 0} · {titel}
      </span>
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
      <button className="gefahr" data-testid="praesentation-ende" onClick={beendePraesentation}>
        {t.praesentation.beenden}
      </button>
    </div>
  );
}
