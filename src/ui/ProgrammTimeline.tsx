import { useMemo, useRef } from 'react';
import { t } from '../i18n/de-CH';
import { useProgramm } from '../store/programm';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { formatKurz, formatZeit } from '../video/bildmathe';
import { baueProgrammPlan } from '../wiedergabe/plan';
import { aktuelleFps } from '../wiedergabe/transport';
import { useZeichnen } from '../store/zeichnen';
import { WERKZEUG_NAMEN } from '../zeichnen/geometrie';
import { ausblendenVon } from '../overlay/ausblenden';
import { ZeitBalken } from './ZeitBalken';
import { KommentarBalken } from './KommentarBalken';
import { OriginalWellenform } from './OriginalWellenform';
import { holeAudio } from '../audio/modell';
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
  const clip = projekt?.clips.find((c) => c.id === clipId);
  const quelle = projekt?.quellen.find((q) => q.id === clip?.quelleId);
  const alleZeichnungen = projekt?.zeichnungen;
  const zeichnungsListe = useMemo(
    () => (alleZeichnungen ?? []).filter((z) => z.clipId === clipId),
    [alleZeichnungen, clipId],
  );
  // Bahnen: erste freie Bahn, in der sich die Zeitspannen nicht überlappen
  const bahnVon = useMemo(() => {
    const bahnen: number[] = [];
    const m = new Map<string, number>();
    for (const z of [...zeichnungsListe].sort((x, y) => x.start - y.start)) {
      let b = bahnen.findIndex((e) => e <= z.start + 1e-9);
      if (b < 0) b = Math.min(bahnen.length, 3);
      bahnen[b] = Math.max(bahnen[b] ?? 0, z.ende);
      m.set(z.id, b);
    }
    return m;
  }, [zeichnungsListe]);
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
        <div className={s.reihe} style={{ height: art === 'playlist' ? 62 : 46 }}>
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
                style={{
                  left: pct(seg.start),
                  width: pct(seg.dauer),
                  bottom: art === 'playlist' ? 16 : 0,
                }}
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
        </div>
        {art === 'clip' && clipId && clip && (
          <>
            <div className={s.reihe} style={{ height: 32 }} data-testid="overlay-spur">
              {(['logo', 'scoreboard'] as const).map((k, reihe) =>
                ausblendenVon(clip, k).map((ab, i) => (
                  <ZeitBalken
                    key={`${k}${i}`}
                    start={ab.start}
                    ende={ab.ende}
                    dauer={plan.dauer}
                    spurRef={ref}
                    top={reihe * 16}
                    farbe="#8a2b2b"
                    textfarbe="#fff"
                    label={k === 'logo' ? t.overlay.spurLogo : t.overlay.spurScore}
                    aria={k === 'logo' ? t.overlay.spurLogo : t.overlay.spurScore}
                    testid={`overlay-balken-${k}`}
                    kantenTestid={`overlay-${k}`}
                    onCommit={(st, en) =>
                      useProjekt.getState().aendere('Overlay-Abschnitt', (pr) => {
                        const c = pr.clips.find((x) => x.id === clipId);
                        const liste = c?.ausblenden?.[k];
                        if (liste?.[i]) liste[i] = { start: st, ende: en };
                      })
                    }
                  />
                )),
              )}
            </div>
            <div
              className={`${s.reihe} ${s.audioLane}`}
              style={{ height: 26 }}
              data-testid="original-spur"
            >
              <span className={s.reiheLabel}>{t.ton.original_spur}</span>
              <OriginalWellenform
                clip={clip}
                quelle={quelle}
                segmente={plan.segmente}
                dauer={plan.dauer}
              />
            </div>
            {holeAudio(clip).spuren.map((sp) => (
              <div
                key={sp.id}
                className={`${s.reihe} ${s.audioLane}`}
                style={{ height: 26 }}
                data-testid="kommentar-spur"
              >
                <span className={s.reiheLabel}>{sp.name}</span>
                {sp.segmente.map((seg) => (
                  <KommentarBalken
                    key={seg.id}
                    clipId={clip.id}
                    spur={sp}
                    seg={seg}
                    dauer={plan.dauer}
                    spurRef={ref}
                  />
                ))}
              </div>
            ))}
            <div
              className={s.reihe}
              style={{ height: zeichnungsListe.length ? 66 : 0 }}
              data-testid="zeichnungs-spur"
            >
              {zeichnungsListe.length > 0 && (
                <span className={s.reiheLabel}>{t.zeichnen.spur}</span>
              )}
              {zeichnungsListe.map((z) => (
                <ZeitBalken
                  key={z.id}
                  start={z.start}
                  ende={z.ende}
                  dauer={plan.dauer}
                  spurRef={ref}
                  top={(bahnVon.get(z.id) ?? 0) * 16 + (zeichnungsListe.length ? 0 : 0)}
                  farbe={z.stil.farbe}
                  textfarbe={
                    ['#000000', '#007057'].includes(z.stil.farbe.toLowerCase()) ? '#fff' : '#000'
                  }
                  label={WERKZEUG_NAMEN[z.werkzeug]}
                  aria={WERKZEUG_NAMEN[z.werkzeug]}
                  ausgewaehlt={auswahlId === z.id}
                  testid="zeichnungs-balken"
                  kantenTestid="zeit"
                  onAuswahl={() => useZeichnen.getState().waehle(z.id)}
                  onCommit={(st, en) =>
                    useProjekt.getState().aendere('Zeitspanne ändern', (pr) => {
                      const zz = pr.zeichnungen.find((x) => x.id === z.id);
                      if (zz) {
                        zz.start = st;
                        zz.ende = en;
                      }
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
        <div
          className={s.kopf}
          style={{ left: pct(Math.min(zeit, plan.dauer)) }}
          data-testid="programm-playhead"
        />
      </div>
    </div>
  );
}
