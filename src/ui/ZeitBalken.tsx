import { useState, type RefObject } from 'react';
import s from './ProgrammTimeline.module.css';

interface Props {
  start: number;
  ende: number;
  /** Gesamtdauer der Zeitleiste (Sekunden) */
  dauer: number;
  spurRef: RefObject<HTMLDivElement | null>;
  top: number;
  /** Höhe in Pixel (Standard 14) */
  hoehe?: number;
  farbe: string;
  textfarbe?: string;
  label: string;
  /** z. B. Wellenform hinter der Beschriftung */
  children?: React.ReactNode;
  aria: string;
  ausgewaehlt?: boolean;
  testid: string;
  kantenTestid: string;
  minLaenge?: number;
  onAuswahl?: () => void;
  /** Wird beim Loslassen mit der neuen Zeitspanne aufgerufen (nur wenn sie sich geändert hat). */
  onCommit: (start: number, ende: number) => void;
}

interface Zieh {
  modus: 'bewegen' | 'links' | 'rechts';
  x0: number;
  start: number;
  ende: number;
  neuStart: number;
  neuEnde: number;
}

/** Ziehbarer Zeitbalken: Mitte verschiebt, Ränder ändern Start bzw. Ende. */
export function ZeitBalken(p: Props) {
  const [zieh, setZieh] = useState<Zieh | null>(null);
  const min = p.minLaenge ?? 0.2;
  const start = zieh ? zieh.neuStart : p.start;
  const ende = zieh ? zieh.neuEnde : p.ende;
  const pct = (x: number) => `${(x / Math.max(p.dauer, 0.001)) * 100}%`;

  const beginne = (e: React.PointerEvent, modus: Zieh['modus']) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Ereignisse */
    }
    p.onAuswahl?.();
    setZieh({
      modus,
      x0: e.clientX,
      start: p.start,
      ende: p.ende,
      neuStart: p.start,
      neuEnde: p.ende,
    });
  };
  const bewege = (e: React.PointerEvent) => {
    if (!zieh || !p.spurRef.current) return;
    const dt = ((e.clientX - zieh.x0) / p.spurRef.current.getBoundingClientRect().width) * p.dauer;
    let a = zieh.start;
    let b = zieh.ende;
    if (zieh.modus === 'bewegen') {
      const l = b - a;
      a = Math.min(Math.max(0, a + dt), Math.max(0, p.dauer - l));
      b = a + l;
    } else if (zieh.modus === 'links') a = Math.min(Math.max(0, a + dt), b - min);
    else b = Math.max(Math.min(p.dauer, b + dt), a + min);
    setZieh({ ...zieh, neuStart: Math.round(a * 100) / 100, neuEnde: Math.round(b * 100) / 100 });
  };
  const ende_ = () => {
    if (zieh && (zieh.neuStart !== zieh.start || zieh.neuEnde !== zieh.ende))
      p.onCommit(zieh.neuStart, zieh.neuEnde);
    setZieh(null);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={p.ausgewaehlt ?? false}
      aria-label={`${p.aria} ${start.toFixed(1)}–${ende.toFixed(1)} s`}
      data-testid={p.testid}
      className={s.zBalken}
      style={{
        left: pct(start),
        width: pct(ende - start),
        top: p.top,
        ...(p.hoehe ? { height: p.hoehe, minHeight: p.hoehe } : {}),
        background: p.farbe,
        color: p.textfarbe ?? '#000',
      }}
      onPointerDown={(e) => beginne(e, 'bewegen')}
      onPointerMove={bewege}
      onPointerUp={ende_}
      onPointerCancel={ende_}
    >
      {p.children}
      <span style={{ position: 'relative' }}>{p.label}</span>
      <span
        className={`${s.zKante} ${s.l}`}
        data-testid={`${p.kantenTestid}-links`}
        onPointerDown={(e) => beginne(e, 'links')}
        onPointerMove={bewege}
        onPointerUp={ende_}
      />
      <span
        className={`${s.zKante} ${s.r}`}
        data-testid={`${p.kantenTestid}-rechts`}
        onPointerDown={(e) => beginne(e, 'rechts')}
        onPointerMove={bewege}
        onPointerUp={ende_}
      />
    </div>
  );
}
