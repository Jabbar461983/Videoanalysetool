import { useMemo, useRef } from 'react';
import { t } from '../i18n/de-CH';
import { useProgramm } from '../store/programm';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { formatKurz, formatZeit } from '../video/bildmathe';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { aktuelleFps } from '../wiedergabe/transport';
import s from './ProgrammTimeline.module.css';

/** Zeitleiste für den Clip-Editor (eine Clip-Zeitachse) und die Playlist (alle Einträge hintereinander). */
export function ProgrammTimeline() {
  const projekt = useProjekt((x) => x.projekt);
  const art = useProgramm((g) => g.art);
  const clipId = useProgramm((g) => g.clipId);
  const playlistId = useProgramm((g) => g.playlistId);
  const zeit = usePlayer((p) => p.zeit);
  const ref = useRef<HTMLDivElement>(null);
  const plan = useMemo(
    () => baueProgrammPlan(projekt, art, clipId, playlistId),
    [projekt, art, clipId, playlistId],
  );
  if (!plan) return null;
  const dauer = Math.max(plan.dauer, 0.001);
  const pct = (x: number) => `${(x / dauer) * 100}%`;
  const springe = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(0, (clientX - r.left) / r.width), 1);
    usePlayer.getState().suche(x * plan.dauer);
  };
  const schritt =
    [1, 2, 5, 10, 30, 60, 120, 300].find(
      (x) => (x / dauer) * (ref.current?.clientWidth ?? 800) >= 70,
    ) ?? 600;
  const ticks: number[] = [];
  for (let x = 0; x <= plan.dauer; x += schritt) ticks.push(x);
  const fps = aktuelleFps();
  const clipName = (id?: string) => projekt?.clips.find((c) => c.id === id)?.name ?? '';

  return (
    <div className={s.wrap}>
      <div className={s.bar}>
        <span className="kicker">{art === 'clip' ? t.programm.clip : t.programm.playlist}</span>
        <span className="hinweis">{formatZeit(plan.dauer, fps)}</span>
      </div>
      <div
        ref={ref}
        className={s.spur}
        data-testid="programm-timeline"
        role="slider"
        aria-label={art === 'clip' ? t.programm.clip : t.programm.playlist}
        aria-valuemin={0}
        aria-valuemax={Math.round(plan.dauer)}
        aria-valuenow={Math.round(zeit)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          springe(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) springe(e.clientX);
        }}
      >
        <div className={s.lineal}>
          {ticks.map((x) => (
            <span key={x} className={s.tick} style={{ left: pct(x) }}>
              {formatKurz(x)}
            </span>
          ))}
        </div>
        {plan.segmente.map((seg, i) => {
          const klasse =
            seg.art === 'titel'
              ? s.titel
              : seg.art === 'freeze'
                ? s.freeze
                : seg.tempo !== 1
                  ? s.zeitlupe
                  : s.video;
          const erstes = i === 0 || plan.segmente[i - 1]!.eintragIndex !== seg.eintragIndex;
          const text =
            seg.art === 'titel'
              ? seg.titel?.titel
              : seg.art === 'freeze'
                ? t.clipEditor.standbild
                : seg.tempo !== 1
                  ? `${seg.tempo}×`
                  : erstes && art === 'playlist'
                    ? clipName(seg.clipId)
                    : '';
          return (
            <div
              key={i}
              data-testid={`seg-${seg.art}`}
              className={`${s.seg} ${klasse}`}
              style={{ left: pct(seg.start), width: pct(seg.dauer) }}
              title={text}
            >
              {text}
            </div>
          );
        })}
        {plan.eintraege.slice(1).map((e) => (
          <div key={e.eintrag.id}>
            <div className={s.trenner} style={{ left: pct(e.start) }} />
            {e.eintrag.uebergang === 'blende' && (
              <span className={s.blende} style={{ left: pct(e.start) }}>
                {t.playlist.blende}
              </span>
            )}
          </div>
        ))}
        <div
          className={s.kopf}
          style={{ left: pct(Math.min(zeit, plan.dauer)) }}
          data-testid="programm-playhead"
        />
      </div>
    </div>
  );
}
