import { useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { klickAufSpieler, sichereHintergrund, waehleSpieler } from '../ki/spielerAktionen';
import { keyframeBei, istSpielerSichtbar } from '../render/spieler';
import { spielerBox } from '../render/perspektive';
import { usePlayer } from '../store/player';
import { useProjekt } from '../store/projektStore';
import { useSpielerKi } from '../store/spielerKi';
import { aktuelleClipId } from '../zeichnen/aktionen';
import s from './ZeichenEbene.module.css';

type Meldungen = keyof typeof t.spieler;

/** Eingabeschicht des Spieler-Werkzeugs: Klick = freistellen, Shift/Alt = korrigieren, Ziehen = verschieben. */
export function SpielerEbene() {
  const ref = useRef<HTMLDivElement>(null);
  const zieh = useRef<{
    start: { x: number; y: number };
    original: { x: number; y: number };
    id: string;
  } | null>(null);
  const status = useSpielerKi((x) => x.status);
  const prozent = useSpielerKi((x) => x.prozent);
  const meldung = useSpielerKi((x) => x.meldung);
  const detail = useSpielerKi((x) => x.detail);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  /** Spieler unter dem Zeiger (oberster zuerst), nach Maskenrahmen. */
  const treffer = (pos: { x: number; y: number }) => {
    const clipId = aktuelleClipId();
    const tt = usePlayer.getState().zeit;
    const liste = (useProjekt.getState().projekt?.spielerObjekte ?? []).filter(
      (o) => o.clipId === clipId && istSpielerSichtbar(o, tt),
    );
    return [...liste].reverse().find((o) => {
      const k = keyframeBei(o, tt)?.kf;
      if (!k) return false;
      const { x, y, b, h } = spielerBox(o, k);
      return pos.x >= x && pos.x <= x + b && pos.y >= y && pos.y <= y + h;
    });
  };

  const onDown = async (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Ereignisse (Tests) */
    }
    const pos = norm(e);
    const st = useSpielerKi.getState();
    setHinweis(null);
    const art = e.shiftKey ? 'plus' : e.altKey ? 'minus' : st.klickArt;

    // Verschieben: Ziehen im ausgewählten Spieler
    if (st.verschieben && st.auswahlId && art === 'neu') {
      const o = useProjekt.getState().projekt?.spielerObjekte.find((x) => x.id === st.auswahlId);
      const th = o ? treffer(pos) : undefined;
      if (o && th?.id === o.id) {
        if (!o.maskenKeyframes[0]?.hintergrund) {
          await sichereHintergrund(o.id);
          return;
        }
        zieh.current = { start: pos, original: { ...o.versatz }, id: o.id };
        return;
      }
    }
    // Anderen vorhandenen Spieler auswählen (ohne Korrektur-Modifier)
    if (art === 'neu') {
      const th = treffer(pos);
      if (th) {
        waehleSpieler(th.id);
        return;
      }
    }
    const fehler = await klickAufSpieler(pos, art);
    if (fehler && fehler in t.spieler) {
      const v = t.spieler[fehler as Meldungen];
      setHinweis(typeof v === 'function' ? (v as (n: number) => string)(3) : (v as string));
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const z = zieh.current;
    if (!z) return;
    const pos = norm(e);
    useProjekt.getState().aendereStill((d) => {
      const o = d.spielerObjekte.find((x) => x.id === z.id);
      if (o)
        o.versatz = { x: z.original.x + pos.x - z.start.x, y: z.original.y + pos.y - z.start.y };
    });
  };

  const onUp = (e: React.PointerEvent) => {
    const z = zieh.current;
    zieh.current = null;
    if (!z) return;
    const pos = norm(e);
    const ziel = { x: z.original.x + pos.x - z.start.x, y: z.original.y + pos.y - z.start.y };
    // Ein sauberer Undo-Schritt: erst zurück auf den Ausgangswert, dann die eigentliche Änderung
    useProjekt.getState().aendereStill((d) => {
      const o = d.spielerObjekte.find((x) => x.id === z.id);
      if (o) o.versatz = z.original;
    });
    if (Math.abs(ziel.x - z.original.x) + Math.abs(ziel.y - z.original.y) < 1e-4) return;
    useProjekt.getState().aendere('Spieler verschieben', (d) => {
      const o = d.spielerObjekte.find((x) => x.id === z.id);
      if (o) o.versatz = ziel;
    });
  };

  const text =
    status === 'laedt'
      ? t.spieler.ladeModell(prozent)
      : status === 'rechnet'
        ? t.spieler.rechnet
        : status === 'fuellt'
          ? t.spieler.fuellt
          : (hinweis ??
            (meldung && meldung in t.spieler ? (t.spieler[meldung as Meldungen] as string) : null));

  return (
    <div
      ref={ref}
      className={`${s.ebene} ${s.zeichnen}`}
      data-testid="spielerebene"
      onPointerDown={(e) => void onDown(e)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {text && (
        <div
          role="status"
          data-testid="spieler-status"
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            maxWidth: '90%',
            padding: '6px 10px',
            background: 'var(--bd-scrim)',
            border: '1px solid var(--bd-gold)',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          {text}
          {status === 'fehler' && detail && (
            <div data-testid="spieler-detail" style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
              {t.spieler.technisch}: {detail.slice(0, 300)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
