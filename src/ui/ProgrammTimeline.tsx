import { useMemo, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { useProgramm } from '../store/programm';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { formatKurz, formatZeit } from '../video/bildmathe';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { aktuelleFps } from '../wiedergabe/transport';
import { useZeichnen } from '../store/zeichnen';
import { WERKZEUG_NAMEN } from '../zeichnen/geometrie';
import type { Zeichnung } from '../model/typen';
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
  const auswahlId = useZeichnen((z) => z.auswahlId);
  const [zieh, setZieh] = useState<{
    id: string;
    modus: 'bewegen' | 'links' | 'rechts';
    x0: number;
    start: number;
    ende: number;
    neuStart: number;
    neuEnde: number;
  } | null>(null);
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
        {art === 'clip' &&
          clipId &&
          (() => {
            const liste = (projekt?.zeichnungen ?? []).filter((z) => z.clipId === clipId);
            if (liste.length === 0) return null;
            // Bahnen: erste freie Bahn, in der sich die Zeitspannen nicht überlappen
            const bahnen: number[] = [];
            const bahnVon = new Map<string, number>();
            for (const z of [...liste].sort((a, b) => a.start - b.start)) {
              let b = bahnen.findIndex((ende) => ende <= z.start + 1e-9);
              if (b < 0) b = Math.min(bahnen.length, 3);
              bahnen[b] = Math.max(bahnen[b] ?? 0, z.ende);
              bahnVon.set(z.id, b);
            }
            const wert = (z: Zeichnung) =>
              zieh && zieh.id === z.id
                ? { start: zieh.neuStart, ende: zieh.neuEnde }
                : { start: z.start, ende: z.ende };
            const beginne = (
              e: React.PointerEvent,
              z: Zeichnung,
              modus: 'bewegen' | 'links' | 'rechts',
            ) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              useZeichnen.getState().waehle(z.id);
              setZieh({
                id: z.id,
                modus,
                x0: e.clientX,
                start: z.start,
                ende: z.ende,
                neuStart: z.start,
                neuEnde: z.ende,
              });
            };
            const bewege = (e: React.PointerEvent) => {
              if (!zieh || !ref.current) return;
              const dt =
                ((e.clientX - zieh.x0) / ref.current.getBoundingClientRect().width) * plan.dauer;
              let a = zieh.start;
              let b = zieh.ende;
              if (zieh.modus === 'bewegen') {
                const l = b - a;
                a = Math.min(Math.max(0, a + dt), plan.dauer - l);
                b = a + l;
              } else if (zieh.modus === 'links') a = Math.min(Math.max(0, a + dt), b - 0.2);
              else b = Math.max(Math.min(plan.dauer, b + dt), a + 0.2);
              setZieh({
                ...zieh,
                neuStart: Math.round(a * 100) / 100,
                neuEnde: Math.round(b * 100) / 100,
              });
            };
            const ende = () => {
              if (zieh && (zieh.neuStart !== zieh.start || zieh.neuEnde !== zieh.ende)) {
                const g = zieh;
                useProjekt.getState().aendere('Zeitspanne ändern', (p) => {
                  const z = p.zeichnungen.find((x) => x.id === g.id);
                  if (z) {
                    z.start = g.neuStart;
                    z.ende = g.neuEnde;
                  }
                });
              }
              setZieh(null);
            };
            return (
              <div data-testid="zeichnungs-spur">
                <span className={s.zSpurLabel}>{t.zeichnen.spur}</span>
                {liste.map((z) => {
                  const w = wert(z);
                  return (
                    <div
                      key={z.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={auswahlId === z.id}
                      aria-label={`${WERKZEUG_NAMEN[z.werkzeug]} ${w.start.toFixed(1)}–${w.ende.toFixed(1)} s`}
                      data-testid="zeichnungs-balken"
                      className={s.zBalken}
                      style={{
                        left: pct(w.start),
                        width: pct(w.ende - w.start),
                        top: 124 + (bahnVon.get(z.id) ?? 0) * 16,
                        background: z.stil.farbe,
                        color: ['#000000', '#007057'].includes(z.stil.farbe.toLowerCase())
                          ? '#fff'
                          : '#000',
                      }}
                      onPointerDown={(e) => beginne(e, z, 'bewegen')}
                      onPointerMove={bewege}
                      onPointerUp={ende}
                      onPointerCancel={ende}
                    >
                      {WERKZEUG_NAMEN[z.werkzeug]}
                      <span
                        className={`${s.zKante} ${s.l}`}
                        data-testid="zeit-links"
                        onPointerDown={(e) => beginne(e, z, 'links')}
                        onPointerMove={bewege}
                        onPointerUp={ende}
                      />
                      <span
                        className={`${s.zKante} ${s.r}`}
                        data-testid="zeit-rechts"
                        onPointerDown={(e) => beginne(e, z, 'rechts')}
                        onPointerMove={bewege}
                        onPointerUp={ende}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        <div
          className={s.kopf}
          style={{ left: pct(Math.min(zeit, plan.dauer)) }}
          data-testid="programm-playhead"
        />
      </div>
    </div>
  );
}
