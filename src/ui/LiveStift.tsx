import { useEffect, useRef } from 'react';
import { useUi } from '../store/ui';
import { spieler } from '../wiedergabe/transport';
import { beende, ignoriereBeginn, neuerPalmZustand, nimmAn, vermerkeStift } from '../zeichnen/palm';

interface Strich {
  farbe: string;
  punkte: { x: number; y: number }[];
}

/**
 * Live-Stift im Präsentationsmodus: freies Zeichnen über dem Bild für die Teamsitzung.
 * Wird nicht gespeichert und nicht exportiert. Stift zeichnet immer; Maus/Finger nur, wenn der Schalter an ist.
 * Koordinaten normiert (0–1), damit die Zeichnung beim Vergrössern/Verkleinern des Fensters mitgeht.
 */
export function LiveStift() {
  const ref = useRef<HTMLCanvasElement>(null);
  const striche = useRef<Strich[]>([]);
  const aktiv = useRef<Strich | null>(null);
  const palm = useRef(neuerPalmZustand());
  const loeschen = useUi((u) => u.liveLoeschen);

  const zeichne = () => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, c.width / 260);
    for (const s of [...striche.current, ...(aktiv.current ? [aktiv.current] : [])]) {
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

  // Grösse an das Element koppeln
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const anpassen = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width * window.devicePixelRatio));
      c.height = Math.max(1, Math.round(r.height * window.devicePixelRatio));
      zeichne();
    };
    anpassen();
    const ro = new ResizeObserver(anpassen);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // «C» bzw. Knopf «Löschen» und Eintragswechsel
  useEffect(() => {
    striche.current = [];
    aktiv.current = null;
    zeichne();
  }, [loeschen]);

  const norm = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  return (
    <canvas
      ref={ref}
      data-testid="live-stift"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 8,
        touchAction: 'none',
        cursor: 'crosshair',
      }}
      onPointerEnter={(e) => vermerkeStift(e, palm.current, performance.now())}
      onPointerDown={(e) => {
        vermerkeStift(e, palm.current, performance.now());
        const erlaubt = e.pointerType === 'pen' || useUi.getState().liveStift;
        console.log('[live] down', e.pointerType, erlaubt, ignoriereBeginn(e, palm.current, performance.now()), e.button);
        if (!erlaubt || ignoriereBeginn(e, palm.current, performance.now())) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        nimmAn(e, palm.current);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* synthetisch */
        }
        spieler.pausiere(); // beim Zeichnen anhalten, damit das Bild steht
        aktiv.current = { farbe: useUi.getState().liveFarbe, punkte: [norm(e)] };
        zeichne();
      }}
      onPointerMove={(e) => {
        vermerkeStift(e, palm.current, performance.now());
        if (!aktiv.current) return;
        const nativ = e.nativeEvent;
        const gesammelt = nativ.getCoalescedEvents?.();
        for (const ev of gesammelt && gesammelt.length ? gesammelt : [nativ]) {
          const r = ref.current!.getBoundingClientRect();
          aktiv.current.punkte.push({
            x: (ev.clientX - r.left) / r.width,
            y: (ev.clientY - r.top) / r.height,
          });
        }
        zeichne();
      }}
      onPointerUp={(e) => {
        beende(e, palm.current);
        if (aktiv.current) striche.current.push(aktiv.current);
        aktiv.current = null;
        zeichne();
      }}
      onPointerCancel={(e) => {
        beende(e, palm.current);
        aktiv.current = null;
        zeichne();
      }}
    />
  );
}
