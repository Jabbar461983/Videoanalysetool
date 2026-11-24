import { aufAllenFenstern } from '../layout/fenster';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { neueId } from '../model/schema';
import type { Situation, TaktikMarker, TaktikPfeil } from '../model/typen';
import { useProjekt } from '../store/projektStore';
import { useTaktik, type TafelWerkzeug } from '../store/taktik';
import { exportiereTafelPng } from '../taktik/aktionen';
import { dupliziereSituation, neuerMarker } from '../taktik/logik';
import {
  MARKER_RADIUS_M,
  tafelAbbildung,
  tafelSeitenverhaeltnis,
  zeichneTafel,
  type Rechteck,
} from '../taktik/tafel';

const abstandZurStrecke = (
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const f = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return Math.hypot(px - (a.x + f * dx), py - (a.y + f * dy));
};

const WERKZEUGE: { id: TafelWerkzeug; label: string }[] = [
  { id: 'auswahl', label: t.taktik.wAuswahl },
  { id: 'team1', label: t.taktik.wTeam1 },
  { id: 'team2', label: t.taktik.wTeam2 },
  { id: 'ball', label: t.taktik.wBall },
  { id: 'laufweg', label: t.taktik.wLaufweg },
  { id: 'pass', label: t.taktik.wPass },
  { id: 'schuss', label: t.taktik.wSchuss },
  { id: 'loeschen', label: t.taktik.wLoeschen },
];

type Entwurf =
  | { typ: 'marker'; id: string; x: number; y: number }
  | {
      typ: 'pfeil';
      art: TaktikPfeil['art'];
      von: { x: number; y: number };
      nach: { x: number; y: number };
    }
  | null;

/** Grosser Tafel-Editor (Dialog): Spieler setzen/verschieben, Pfeile zeichnen, Situation benennen, PNG. */
export function TafelEditor() {
  const offen = useTaktik((x) => x.editorOffen);
  const situationId = useTaktik((x) => x.situationId);
  const werkzeug = useTaktik((x) => x.werkzeug);
  const markerId = useTaktik((x) => x.markerId);
  const projekt = useProjekt((x) => x.projekt);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entwurf, setEntwurf] = useState<Entwurf>(null);
  const zieh = useRef<{ id: string } | null>(null);
  const feld = projekt?.taktik.feld;
  const situation = projekt?.taktik.situationen.find((s) => s.id === situationId);
  const loescheMarker = (sid: string, mid: string) => {
    useProjekt.getState().aendere('Marker entfernen', (p) => {
      const s = p.taktik.situationen.find((x) => x.id === sid);
      if (s) s.marker = s.marker.filter((m) => m.id !== mid);
    });
    useTaktik.getState().setze({ markerId: null });
  };
  const B = 1000;
  const H = feld ? Math.round(B / tafelSeitenverhaeltnis(feld)) : 500;
  const rect: Rechteck = useMemo(() => ({ x: 0, y: 0, b: B, h: H }), [H]);

  // Zeichnen: gespeicherte Situation plus laufender Entwurf
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !projekt || !feld) return;
    ctx.clearRect(0, 0, B, H);
    const marker = (situation?.marker ?? []).map((m) =>
      entwurf?.typ === 'marker' && entwurf.id === m.id ? { ...m, x: entwurf.x, y: entwurf.y } : m,
    );
    const pfeile = [...(situation?.pfeile ?? [])];
    if (entwurf?.typ === 'pfeil')
      pfeile.push({ id: 'entwurf', art: entwurf.art, von: entwurf.von, nach: entwurf.nach });
    zeichneTafel(ctx, feld, projekt.teams, { marker, pfeile }, rect, { auswahlId: markerId });
  }, [projekt, feld, situation, entwurf, markerId, rect, H]);

  useEffect(() => {
    if (!offen) return;
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const eingabe = el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if (e.key === 'Escape') useTaktik.getState().setze({ editorOffen: false });
      if ((e.key === 'Delete' || e.key === 'Backspace') && !eingabe && markerId && situationId) {
        e.preventDefault();
        loescheMarker(situationId, markerId);
      }
    };
    return aufAllenFenstern('keydown', h);
  }, [offen, markerId, situationId]);

  if (!offen || !projekt || !feld) return null;

  const aendereSit = (name: string, fn: (s: Situation) => void) =>
    useProjekt.getState().aendere(name, (p) => {
      const s = p.taktik.situationen.find((x) => x.id === situationId);
      if (s) fn(s);
    });

  const abb = tafelAbbildung(feld, rect);
  const pos = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * B;
    const py = ((e.clientY - r.top) / r.height) * H;
    return { px, py, ...abb.meter(px, py) };
  };
  const markerBei = (px: number, py: number): TaktikMarker | undefined => {
    const rad = Math.max(10, MARKER_RADIUS_M * abb.s * 1.5);
    let best: TaktikMarker | undefined;
    let bd = Infinity;
    for (const m of situation?.marker ?? []) {
      const p = abb.px(m.x, m.y);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < rad && d < bd) {
        best = m;
        bd = d;
      }
    }
    return best;
  };
  const pfeilBei = (px: number, py: number): TaktikPfeil | undefined =>
    (situation?.pfeile ?? []).find(
      (a) =>
        abstandZurStrecke(px, py, abb.px(a.von.x, a.von.y), abb.px(a.nach.x, a.nach.y)) <
        Math.max(8, abb.s * 0.7),
    );

  const onDown = (e: React.PointerEvent) => {
    if (!situation || !situationId) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Ereignisse (Tests) */
    }
    const p = pos(e);
    const tk = useTaktik.getState();
    if (werkzeug === 'auswahl') {
      const m = markerBei(p.px, p.py);
      tk.setze({ markerId: m?.id ?? null });
      if (m) {
        zieh.current = { id: m.id };
        setEntwurf({ typ: 'marker', id: m.id, x: m.x, y: m.y });
      }
    } else if (werkzeug === 'team1' || werkzeug === 'team2' || werkzeug === 'ball') {
      const m = neuerMarker(
        werkzeug,
        Math.min(feld.laenge, Math.max(0, p.x)),
        Math.min(feld.breite, Math.max(0, p.y)),
      );
      aendereSit('Marker hinzufügen', (s) => void s.marker.push(m));
      tk.setze({ markerId: m.id, werkzeug: 'auswahl' });
    } else if (werkzeug === 'loeschen') {
      const m = markerBei(p.px, p.py);
      if (m) loescheMarker(situationId, m.id);
      else {
        const a = pfeilBei(p.px, p.py);
        if (a)
          aendereSit(
            'Pfeil entfernen',
            (s) => void (s.pfeile = s.pfeile.filter((x) => x.id !== a.id)),
          );
      }
    } else {
      setEntwurf({
        typ: 'pfeil',
        art: werkzeug,
        von: { x: p.x, y: p.y },
        nach: { x: p.x, y: p.y },
      });
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!entwurf) return;
    const p = pos(e);
    if (entwurf.typ === 'marker' && zieh.current)
      setEntwurf({
        ...entwurf,
        x: Math.min(feld.laenge, Math.max(0, p.x)),
        y: Math.min(feld.breite, Math.max(0, p.y)),
      });
    else if (entwurf.typ === 'pfeil') setEntwurf({ ...entwurf, nach: { x: p.x, y: p.y } });
  };
  const onUp = () => {
    const en = entwurf;
    setEntwurf(null);
    const z = zieh.current;
    zieh.current = null;
    if (!en) return;
    if (en.typ === 'marker' && z) {
      const alt = situation?.marker.find((m) => m.id === z.id);
      if (alt && Math.hypot(alt.x - en.x, alt.y - en.y) > 0.05)
        aendereSit('Marker verschieben', (s) => {
          const m = s.marker.find((x) => x.id === z.id);
          if (m) {
            m.x = en.x;
            m.y = en.y;
          }
        });
    } else if (en.typ === 'pfeil' && Math.hypot(en.nach.x - en.von.x, en.nach.y - en.von.y) > 1) {
      aendereSit('Pfeil hinzufügen', (s) => {
        s.pfeile.push({ id: neueId(), art: en.art, von: en.von, nach: en.nach });
      });
    }
  };

  const gewaehlt = situation?.marker.find((m) => m.id === markerId);
  const team =
    gewaehlt && gewaehlt.art !== 'ball'
      ? projekt.teams[gewaehlt.art === 'team1' ? 0 : 1]
      : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.taktik.editorTitel}
      data-testid="tafel-editor"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        zIndex: 80,
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
          width: 'min(1060px, 100%)',
          maxHeight: '100%',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <strong className="kicker" style={{ marginRight: 8 }}>
            {t.taktik.editorTitel}
          </strong>
          <label>
            {t.taktik.situation}{' '}
            <select
              value={situationId ?? ''}
              data-testid="tafel-situation"
              onChange={(e) =>
                useTaktik.getState().setze({ situationId: e.target.value || null, markerId: null })
              }
            >
              {projekt.taktik.situationen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {situation && (
            <input
              type="text"
              aria-label={t.taktik.situationName}
              value={situation.name}
              data-testid="tafel-name"
              onChange={(e) =>
                aendereSit('Situation umbenennen', (s) => void (s.name = e.target.value))
              }
              style={{ minWidth: 160 }}
            />
          )}
          <span style={{ flex: 1 }} />
          {situation && (
            <>
              <button
                onClick={() => {
                  const k = dupliziereSituation(situation);
                  useProjekt
                    .getState()
                    .aendere('Situation duplizieren', (p) => void p.taktik.situationen.push(k));
                  useTaktik.getState().setze({ situationId: k.id, markerId: null });
                }}
              >
                {t.taktik.duplizieren}
              </button>
              <button
                data-testid="tafel-tauschen"
                onClick={() =>
                  aendereSit('Teams tauschen', (s2) => {
                    for (const m of s2.marker) {
                      if (m.art === 'team1') m.art = 'team2';
                      else if (m.art === 'team2') m.art = 'team1';
                    }
                  })
                }
              >
                {t.taktik.teamsTauschen}
              </button>
              <button onClick={() => void exportiereTafelPng(situation.id)} data-testid="tafel-png">
                {t.taktik.png}
              </button>
            </>
          )}
          <button
            className="primaer"
            data-testid="tafel-schliessen"
            onClick={() => useTaktik.getState().setze({ editorOffen: false })}
          >
            {t.taktik.schliessen}
          </button>
        </div>
        {!situation ? (
          <p className="hinweis">{t.taktik.keineSituation}</p>
        ) : (
          <>
            <div
              role="toolbar"
              aria-label={t.taktik.werkzeuge}
              style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}
            >
              {WERKZEUGE.map((w) => (
                <button
                  key={w.id}
                  aria-pressed={werkzeug === w.id}
                  data-testid={`tafel-w-${w.id}`}
                  style={
                    werkzeug === w.id
                      ? { borderColor: 'var(--bd-gold)', color: 'var(--bd-gold)' }
                      : undefined
                  }
                  onClick={() => useTaktik.getState().setze({ werkzeug: w.id })}
                >
                  {w.id === 'team1'
                    ? projekt.teams[0].kuerzel
                    : w.id === 'team2'
                      ? projekt.teams[1].kuerzel
                      : w.label}
                </button>
              ))}
            </div>
            <canvas
              ref={canvasRef}
              width={B}
              height={H}
              data-testid="tafel-canvas"
              style={{
                width: '100%',
                touchAction: 'none',
                cursor: werkzeug === 'auswahl' ? 'default' : 'crosshair',
                border: '1px solid var(--bd-rule)',
              }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
            <p className="hinweis">{t.taktik.hilfe}</p>
            {gewaehlt && (
              <div
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                data-testid="tafel-marker"
              >
                {gewaehlt.art !== 'ball' && (
                  <>
                    <label>
                      {t.taktik.nummer}{' '}
                      <input
                        type="number"
                        min={0}
                        max={99}
                        style={{ width: 70 }}
                        value={gewaehlt.nummer ?? ''}
                        data-testid="tafel-nummer"
                        onChange={(e) =>
                          aendereSit('Nummer', (s) => {
                            const m = s.marker.find((x) => x.id === gewaehlt.id);
                            if (m)
                              m.nummer = e.target.value === '' ? undefined : Number(e.target.value);
                          })
                        }
                      />
                    </label>
                    {team && team.kader.length > 0 && (
                      <select
                        aria-label={t.taktik.ausKader}
                        value=""
                        onChange={(e) => {
                          const sp = team.kader.find((x) => x.id === e.target.value);
                          if (sp)
                            aendereSit('Spieler zuordnen', (s) => {
                              const m = s.marker.find((x) => x.id === gewaehlt.id);
                              if (m) {
                                m.nummer = sp.nummer;
                                m.name = sp.name;
                              }
                            });
                        }}
                      >
                        <option value="">{t.taktik.ausKader}</option>
                        {team.kader.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            #{sp.nummer} {sp.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {gewaehlt.name && <span className="hinweis">{gewaehlt.name}</span>}
                  </>
                )}
                <button className="gefahr" onClick={() => loescheMarker(situation.id, gewaehlt.id)}>
                  {t.taktik.markerEntfernen}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
