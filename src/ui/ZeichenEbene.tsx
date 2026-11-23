import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Punkt, Zeichnung } from '../model/typen';
import { useZeichnen } from '../store/zeichnen';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { spieler, aktuellerPlan } from '../wiedergabe/transport';
import { pfad, setzePunkt, griffIndizes, trifft, verschiebe, zuPx } from '../zeichnen/geometrie';
import {
  naechsteNummer,
  neueZeichnung,
  standardZeitspanne,
  vereinfacheFreihand,
} from '../zeichnen/logik';
import {
  aktuelleClipId,
  ersetzeZeichnung,
  fuegeZeichnungHinzu,
  schliesseZone,
} from '../zeichnen/aktionen';
import { beende, ignoriereBeginn, neuerPalmZustand, nimmAn, vermerkeStift } from '../zeichnen/palm';
import s from './ZeichenEbene.module.css';

type Geste =
  | { typ: 'zeichnen'; start: Punkt }
  | { typ: 'ziehen'; start: Punkt; original: Zeichnung }
  | { typ: 'griff'; index: number; original: Zeichnung };

/**
 * Eingabeschicht über dem Video (nur im Clip-Editor): Zeichnen, Auswählen, Verschieben, Punkte ziehen.
 * Gemalt wird nichts hier – Entwürfe laufen über `ziel.zusatz` in renderFrame(). Hier liegen nur Griffe (DOM).
 */
export function ZeichenEbene({ breite, hoehe }: { breite: number; hoehe: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const palm = useRef(neuerPalmZustand());
  const geste = useRef<Geste | null>(null);
  const roh = useRef<Punkt[]>([]);
  const textStart = useRef<Punkt | null>(null);
  const werkzeug = useZeichnen((z) => z.werkzeug);
  const auswahlId = useZeichnen((z) => z.auswahlId);
  const ersatz = useZeichnen((z) => z.ersatz);
  const entwurf = useZeichnen((z) => z.entwurf);
  const projekt = useProjekt((x) => x.projekt);
  const [textPos, setTextPos] = useState<Punkt | null>(null);

  const ausgewaehlt = ersatz ?? projekt?.zeichnungen.find((z) => z.id === auswahlId);

  // Werkzeugwechsel: offene Zone abschliessen, Texteingabe schliessen
  useEffect(() => {
    setTextPos(null);
  }, [werkzeug]);

  const norm = (e: { clientX: number; clientY: number }): Punkt => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const cssZuBild = (): number => breite / (ref.current?.getBoundingClientRect().width || breite);

  const zeitspanne = () =>
    standardZeitspanne(aktuellerPlan()?.segmente ?? [], usePlayer.getState().zeit);

  const sichtbareZeichnungen = (): Zeichnung[] => {
    const clipId = aktuelleClipId();
    const tt = usePlayer.getState().zeit;
    return (useProjekt.getState().projekt?.zeichnungen ?? []).filter(
      (z) => z.clipId === clipId && tt >= z.start && tt < z.ende,
    );
  };

  const anhalten = () => {
    if (useProjekt.getState().projekt?.einstellungen.zeichnenAnhalten) spieler.pausiere();
  };

  const onDown = (e: React.PointerEvent) => {
    const st = useZeichnen.getState();
    const info = { pointerType: e.pointerType, pointerId: e.pointerId };
    vermerkeStift(info, palm.current, performance.now());
    if (ignoriereBeginn(info, palm.current, performance.now())) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    nimmAn(info, palm.current);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Ereignisse (Tests) haben keinen aktiven Zeiger */
    }
    const pos = norm(e);
    const clipId = aktuelleClipId();
    if (!clipId) return;
    const tol = (e.pointerType === 'touch' ? 18 : 10) * cssZuBild();

    if (st.werkzeug === 'auswahl') {
      const sel = ausgewaehlt;
      if (sel) {
        for (const i of griffIndizes(sel)) {
          const g = zuPx(sel.punkte[i]!, breite, hoehe);
          if (Math.hypot(g.x - pos.x * breite, g.y - pos.y * hoehe) <= tol * 1.4) {
            geste.current = { typ: 'griff', index: i, original: sel };
            return;
          }
        }
      }
      const treffer = [...sichtbareZeichnungen()]
        .reverse()
        .find((z) => trifft(z, { x: pos.x * breite, y: pos.y * hoehe }, breite, hoehe, tol));
      st.waehle(treffer?.id ?? null);
      if (treffer) geste.current = { typ: 'ziehen', start: pos, original: treffer };
      return;
    }

    anhalten();
    const zeit = zeitspanne();
    const w = st.werkzeug;
    if (w === 'text') {
      // Eingabefeld erst beim Loslassen öffnen, sonst nimmt der Browser dem Feld den Fokus gleich wieder weg
      textStart.current = pos;
      return;
    }
    if (w === 'marker') {
      const p = useProjekt.getState().projekt;
      fuegeZeichnungHinzu(
        neueZeichnung('marker', clipId, [pos], st.stil, zeit, {
          nummer: p ? naechsteNummer(p, clipId) : 1,
        }),
      );
      return;
    }
    if (w === 'zone') {
      const e0 = st.entwurf;
      if (e0 && e0.werkzeug === 'zone') {
        const erste = zuPx(e0.punkte[0]!, breite, hoehe);
        if (
          e0.punkte.length >= 3 &&
          Math.hypot(erste.x - pos.x * breite, erste.y - pos.y * hoehe) <= tol * 1.5
        ) {
          schliesseZone();
        } else st.setzeEntwurf({ ...e0, punkte: [...e0.punkte, pos] });
      } else st.setzeEntwurf(neueZeichnung('zone', clipId, [pos], st.stil, zeit, {}, st.animation));
      return;
    }
    const d = e.pointerType === 'pen' && st.druck ? e.pressure : undefined;
    if (w === 'freihand') {
      roh.current = [{ ...pos, ...(d !== undefined ? { d } : {}) }];
      st.setzeEntwurf(
        neueZeichnung('freihand', clipId, roh.current.slice(), st.stil, zeit, {}, st.animation),
      );
    } else if (w === 'kreis') {
      st.setzeEntwurf(
        neueZeichnung('kreis', clipId, [pos, pos, pos], st.stil, zeit, {}, st.animation),
      );
    } else {
      st.setzeEntwurf(neueZeichnung(w, clipId, [pos, pos], st.stil, zeit, {}, st.animation));
    }
    geste.current = { typ: 'zeichnen', start: pos };
  };

  const onMove = (e: React.PointerEvent) => {
    vermerkeStift(
      { pointerType: e.pointerType, pointerId: e.pointerId },
      palm.current,
      performance.now(),
    );
    const g = geste.current;
    if (!g) return;
    const st = useZeichnen.getState();
    const pos = norm(e);
    if (g.typ === 'ziehen') {
      st.setzeErsatz(verschiebe(g.original, pos.x - g.start.x, pos.y - g.start.y));
    } else if (g.typ === 'griff') {
      st.setzeErsatz(setzePunkt(g.original, g.index, pos));
    } else if (st.entwurf) {
      const z = st.entwurf;
      if (z.werkzeug === 'freihand') {
        const native = e.nativeEvent as PointerEvent;
        const ereignisse = native.getCoalescedEvents?.() ?? [native];
        for (const ev of ereignisse.length ? ereignisse : [native]) {
          const q = norm(ev);
          const letzter = roh.current[roh.current.length - 1];
          if (!letzter || Math.hypot((q.x - letzter.x) * breite, (q.y - letzter.y) * hoehe) >= 2) {
            const d = e.pointerType === 'pen' && st.druck ? ev.pressure : undefined;
            roh.current.push({ ...q, ...(d !== undefined ? { d } : {}) });
          }
        }
        st.setzeEntwurf({ ...z, punkte: roh.current.slice() });
      } else if (z.werkzeug === 'kreis') {
        const r = Math.hypot((pos.x - g.start.x) * breite, (pos.y - g.start.y) * hoehe);
        st.setzeEntwurf({
          ...z,
          punkte: [
            g.start,
            { x: g.start.x + r / breite, y: g.start.y },
            { x: g.start.x, y: g.start.y + (r * 0.45) / hoehe },
          ],
        });
      } else if (z.werkzeug === 'pfeil' || z.werkzeug === 'linie') {
        st.setzeEntwurf({ ...z, punkte: [g.start, pos] });
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    beende({ pointerType: e.pointerType, pointerId: e.pointerId }, palm.current);
    if (textStart.current) {
      setTextPos(textStart.current);
      textStart.current = null;
      return;
    }
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    const st = useZeichnen.getState();
    if (g.typ === 'ziehen' || g.typ === 'griff') {
      const neu = st.ersatz;
      st.setzeErsatz(null);
      if (neu && JSON.stringify(neu.punkte) !== JSON.stringify(g.original.punkte)) {
        ersetzeZeichnung(neu, g.typ === 'ziehen' ? 'Zeichnung verschieben' : 'Punkt verschieben');
      }
      return;
    }
    const z = st.entwurf;
    st.setzeEntwurf(null);
    if (!z) return;
    const [a, b] = z.punkte;
    if (z.werkzeug === 'freihand') {
      const punkte = vereinfacheFreihand(roh.current, breite, hoehe);
      roh.current = [];
      if (punkte.length >= 2) fuegeZeichnungHinzu({ ...z, punkte });
    } else if (a && b && Math.hypot((a.x - b.x) * breite, (a.y - b.y) * hoehe) > 6) {
      fuegeZeichnungHinzu(z);
    }
  };

  const textFertig = (wert: string) => {
    const pos = textPos;
    setTextPos(null);
    const clipId = aktuelleClipId();
    const st = useZeichnen.getState();
    if (pos && clipId && wert.trim()) {
      fuegeZeichnungHinzu(
        neueZeichnung(
          'text',
          clipId,
          [pos],
          st.stil,
          zeitspanne(),
          { text: wert.trim() },
          st.animation,
        ),
      );
    }
  };

  const zeigeGriffe = werkzeug === 'auswahl' && ausgewaehlt;
  const bbox = ausgewaehlt ? umriss(ausgewaehlt, breite, hoehe) : null;

  return (
    <div
      ref={ref}
      className={`${s.ebene} ${werkzeug !== 'auswahl' ? s.zeichnen : ''}`}
      data-testid="zeichenebene"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerEnter={(e) =>
        vermerkeStift(
          { pointerType: e.pointerType, pointerId: e.pointerId },
          palm.current,
          performance.now(),
        )
      }
      onDoubleClick={() => {
        if (useZeichnen.getState().werkzeug === 'zone') {
          // der Doppelklick hat die letzte Ecke doppelt gesetzt
          const e0 = useZeichnen.getState().entwurf;
          if (e0 && e0.punkte.length > 1) {
            const l = e0.punkte[e0.punkte.length - 1]!;
            const v = e0.punkte[e0.punkte.length - 2]!;
            if (Math.hypot((l.x - v.x) * breite, (l.y - v.y) * hoehe) < 8) {
              useZeichnen.getState().setzeEntwurf({ ...e0, punkte: e0.punkte.slice(0, -1) });
            }
          }
          schliesseZone();
        }
      }}
    >
      {bbox && werkzeug === 'auswahl' && (
        <div
          className={s.rahmen}
          style={{
            left: `${bbox.x0 * 100}%`,
            top: `${bbox.y0 * 100}%`,
            width: `${(bbox.x1 - bbox.x0) * 100}%`,
            height: `${(bbox.y1 - bbox.y0) * 100}%`,
          }}
        />
      )}
      {zeigeGriffe &&
        griffIndizes(ausgewaehlt).map((i) => (
          <span
            key={i}
            className={s.griff}
            data-testid="zeichengriff"
            style={{
              left: `${ausgewaehlt.punkte[i]!.x * 100}%`,
              top: `${ausgewaehlt.punkte[i]!.y * 100}%`,
            }}
          />
        ))}
      {entwurf?.werkzeug === 'zone' &&
        entwurf.punkte.map((p, i) => (
          <span
            key={i}
            className={s.griff}
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              background: i === 0 ? '#fff' : undefined,
            }}
          />
        ))}
      {textPos && (
        <input
          autoFocus
          type="text"
          className={s.text}
          data-testid="text-eingabe"
          placeholder={t.zeichnen.textPlatzhalter}
          style={{ left: `${textPos.x * 100}%`, top: `${textPos.y * 100}%` }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') textFertig(e.currentTarget.value);
            if (e.key === 'Escape') setTextPos(null);
          }}
          onBlur={(e) => textFertig(e.currentTarget.value)}
        />
      )}
    </div>
  );
}

/** Umriss (normiert) für die Auswahlanzeige. */
function umriss(z: Zeichnung, w: number, h: number) {
  const pts = pfad(z, w, h);
  const alle = z.werkzeug === 'text' || z.werkzeug === 'marker' ? [zuPx(z.punkte[0]!, w, h)] : pts;
  if (alle.length === 0) return null;
  const pad = z.werkzeug === 'text' ? 0 : z.werkzeug === 'marker' ? 34 : 8;
  const xs = alle.map((p) => p.x);
  const ys = alle.map((p) => p.y);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  let x1 = Math.max(...xs) + pad;
  let y1 = Math.max(...ys) + pad;
  if (z.werkzeug === 'text') {
    const tx = z.text?.length ?? 1;
    x1 = x0 + Math.max(60, tx * (20 + z.stil.staerke * 3) * 0.58 + 30) * (w / 1920);
    y1 = y0 + (20 + z.stil.staerke * 3 + 20) * (w / 1920);
  }
  return {
    x0: Math.max(0, x0 / w),
    y0: Math.max(0, y0 / h),
    x1: Math.min(1, x1 / w),
    y1: Math.min(1, y1 / h),
  };
}
