import { useEffect, useRef } from 'react';
import { useLive } from '../store/live';
import { useUi } from '../store/ui';
import { spieler } from '../wiedergabe/transport';
import { beende, ignoriereBeginn, neuerPalmZustand, nimmAn, vermerkeStift } from '../zeichnen/palm';

/**
 * Live-Stift im Präsentationsmodus: freies Zeichnen über dem Bild für die Teamsitzung.
 * Wird nicht gespeichert und nicht exportiert. Stift zeichnet immer; Maus/Finger nur, wenn der Schalter an ist.
 * Koordinaten normiert (0–1), damit die Zeichnung beim Vergrössern/Verkleinern des Fensters mitgeht.
 * `interaktiv = false`: nur anzeigen (Beamer-Fenster, wenn gezeichnet wird auf dem Spiegelbild im Steuerpult).
 */
export function LiveStift({ interaktiv = true }: { interaktiv?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palm = useRef(neuerPalmZustand());

  const zeichne = () => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const { striche, aktiv } = useLive.getState();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, c.width / 260);
    for (const s of [...striche, ...(aktiv ? [aktiv] : [])]) {
      ctx.strokeStyle = s.farbe;
      ctx.beginPath();
      s.punkte.forEach((p, i) =>
        i === 0
          ? ctx.moveTo(p.x * c.width, p.y * c.height)
          : ctx.lineTo(p.x * c.width, p.y * c.height),
      );
      if (s.punkte.length === 1)
        ctx.lineTo(s.punkte[0]!.x * c.width + 0.1, s.punkte[0]!.y * c.height);
      ctx.stroke();
    }
  };

  // Grösse an das Element koppeln (im Fenster, in dem es liegt)
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const anpassen = () => {
      const r = c.getBoundingClientRect();
      const dpr = c.ownerDocument.defaultView?.devicePixelRatio ?? 1;
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      zeichne();
    };
    anpassen();
    const ro = new ResizeObserver(anpassen);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Änderungen der gemeinsamen Zeichnung (auch aus dem anderen Fenster) anzeigen
  useEffect(() => {
    zeichne();
    return useLive.subscribe(zeichne);
  }, []);

  const norm = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  return (
    <canvas
      ref={ref}
      data-testid={interaktiv ? 'live-stift' : 'live-anzeige'}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 8,
        pointerEvents: interaktiv ? 'auto' : 'none',
        touchAction: 'none',
        cursor: interaktiv ? 'crosshair' : 'none',
      }}
      onPointerEnter={
        interaktiv ? (e) => vermerkeStift(e, palm.current, performance.now()) : undefined
      }
      onPointerDown={
        interaktiv
          ? (e) => {
              vermerkeStift(e, palm.current, performance.now());
              const erlaubt = e.pointerType === 'pen' || useUi.getState().liveStift;
              if (!erlaubt || ignoriereBeginn(e, palm.current, performance.now())) return;
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              nimmAn(e, palm.current);
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* synthetisch */
              }
              spieler.pausiere(); // beim Zeichnen anhalten, damit das Bild steht
              useLive.getState().beginne({ farbe: useUi.getState().liveFarbe, punkte: [norm(e)] });
            }
          : undefined
      }
      onPointerMove={
        interaktiv
          ? (e) => {
              vermerkeStift(e, palm.current, performance.now());
              if (!useLive.getState().aktiv) return;
              const nativ = e.nativeEvent;
              const gesammelt = nativ.getCoalescedEvents?.();
              const r = ref.current!.getBoundingClientRect();
              useLive.getState().erweitere(
                (gesammelt && gesammelt.length ? gesammelt : [nativ]).map((ev) => ({
                  x: (ev.clientX - r.left) / r.width,
                  y: (ev.clientY - r.top) / r.height,
                })),
              );
            }
          : undefined
      }
      onPointerUp={
        interaktiv
          ? (e) => {
              beende(e, palm.current);
              useLive.getState().beende();
            }
          : undefined
      }
      onPointerCancel={
        interaktiv
          ? (e) => {
              beende(e, palm.current);
              useLive.getState().brichAb();
            }
          : undefined
      }
    />
  );
}
