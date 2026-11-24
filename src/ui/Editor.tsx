import { useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { ladeProjekt, dateiKey } from '../db/projekte';
import { useProjekt } from '../store/projektStore';
import { starteAutosave } from '../store/autosave';
import { useDateien } from '../store/dateien';
import { Streifen } from './Streifen';
import { Buehne } from './Buehne';
import { Timeline } from './Timeline';
import { Seitenleiste } from './Seitenleiste';
import { TagLeiste } from './TagLeiste';
import { QuellenBanner } from './QuellenBanner';
import { PraesentationsLeiste } from './PraesentationsLeiste';
import { beendePraesentation } from '../praesentation/aktionen';
import { useUi } from '../store/ui';
import { ProgrammTimeline } from './ProgrammTimeline';
import { useProgramm } from '../store/programm';
import { HotkeyHilfe } from './HotkeyHilfe';
import { TafelEditor } from './TafelEditor';
import { KalibrierDialog } from './KalibrierDialog';
import { ErkennungsDialog } from './ErkennungsDialog';
import { useEditorTasten } from './tasten';
import s from './Editor.module.css';

const ZEIT_KEY = 'bdva-zeit-hoehe';
const ladeHoehe = (): number | null => {
  try {
    const v = Number(localStorage.getItem(ZEIT_KEY));
    return v >= 100 ? v : null;
  } catch {
    return null;
  }
};

export function Editor({ projektId }: { projektId: string }) {
  const projekt = useProjekt((x) => x.projekt);
  const status = useProjekt((x) => x.status);
  const art = useProgramm((g) => g.art);
  const praesi = useUi((u) => u.praesentation);
  const [fehlt, setFehlt] = useState(false);
  const [zeitHoehe, setZeitHoehe] = useState<number | null>(ladeHoehe);
  const [seitenBreite, setSeitenBreite] = useState<number | null>(leseSeitenBreite);

  useEffect(() => {
    let aktiv = true;
    let stop: (() => void) | null = null;
    void ladeProjekt(projektId).then(async (p) => {
      if (!aktiv) return;
      if (!p) {
        setFehlt(true);
        return;
      }
      useProjekt.getState().oeffne(p);
      stop = starteAutosave();
      // Videos still wieder verknüpfen (ohne Dialog); was nicht klappt, fragt der Nutzer im Panel an.
      for (const q of p.quellen) void useDateien.getState().versuche(q, false);
    });
    return () => {
      aktiv = false;
      stop?.();
      useProjekt.getState().schliesse();
    };
  }, [projektId]);

  useEditorTasten();

  // Verlässt der Nutzer das Vollbild (Esc im Browser), endet die Präsentation
  useEffect(() => {
    const f = () => {
      if (!document.fullscreenElement) beendePraesentation();
    };
    document.addEventListener('fullscreenchange', f);
    return () => {
      document.removeEventListener('fullscreenchange', f);
      beendePraesentation();
    };
  }, []);

  if (fehlt)
    return (
      <main style={{ padding: 24 }}>
        <p>{t.editor.nichtGefunden}</p>
        <a href="#/">{t.editor.zurueck}</a>
      </main>
    );
  if (!projekt) return null;
  const q = projekt.quellen.find((x) => x.id === projekt.aktiveQuelleId) ?? projekt.quellen[0];

  return (
    <div
      className={`${s.app} ${praesi ? s.praesi : ''}`}
      data-praesentation={praesi}
      style={
        seitenBreite ? ({ '--seite-b': `${seitenBreite}px` } as React.CSSProperties) : undefined
      }
    >
      <header className={s.kopf}>
        <Streifen hoehe={20} />
        <a href="#/" style={{ color: 'var(--bd-ink)' }}>
          {t.editor.zurueck}
        </a>
        <input
          type="text"
          aria-label={t.editor.projektName}
          value={projekt.name}
          onChange={(e) =>
            useProjekt.getState().aendere('Umbenennen', (p) => {
              p.name = e.target.value;
            })
          }
        />
        <UndoRedo />
        <span className={s.status} role="status">
          {status === 'ausstehend'
            ? t.editor.speichert
            : status === 'fehler'
              ? t.editor.saveFehler
              : t.editor.gespeichert}
        </span>
      </header>
      <section className={s.buehne}>
        {!praesi && <QuellenBanner />}
        <Buehne quelle={q} />
        {art === 'quelle' && !praesi && <TagLeiste />}
      </section>
      <aside className={s.seite} aria-label={t.editor.seitenleiste}>
        <SeitenTeiler breite={seitenBreite} setze={setSeitenBreite} />
        <Seitenleiste />
      </aside>
      <section
        className={`${s.zeit} ${zeitHoehe ? s.zeitFix : ''}`}
        style={zeitHoehe ? { height: zeitHoehe } : undefined}
      >
        <Teiler hoehe={zeitHoehe} setze={setZeitHoehe} />
        {art === 'quelle' ? (
          <Timeline quelle={q} schluessel={q ? dateiKey(q) : ''} />
        ) : (
          <ProgrammTimeline />
        )}
      </section>
      <HotkeyHilfe />
      <TafelEditor />
      <KalibrierDialog />
      <ErkennungsDialog />
      {praesi && <PraesentationsLeiste />}
    </div>
  );
}

function UndoRedo() {
  const { kannUndo, kannRedo, undo, redo } = useProjekt();
  return (
    <>
      <button onClick={undo} disabled={!kannUndo} title="Strg+Z">
        {t.editor.undo}
      </button>
      <button onClick={redo} disabled={!kannRedo} title="Strg+Y">
        {t.editor.redo}
      </button>
    </>
  );
}

/** Griff zum Verändern der Zeitleistenhöhe (Ziehen oder Pfeil hoch/runter; Doppelklick = automatisch). */
function Teiler({ hoehe, setze }: { hoehe: number | null; setze: (h: number | null) => void }) {
  const speichere = (h: number | null) => {
    setze(h);
    try {
      if (h) localStorage.setItem(ZEIT_KEY, String(Math.round(h)));
      else localStorage.removeItem(ZEIT_KEY);
    } catch {
      /* egal */
    }
  };
  const begrenze = (h: number) => Math.round(Math.min(window.innerHeight * 0.7, Math.max(110, h)));
  return (
    <div
      className={s.teiler}
      role="separator"
      aria-orientation="horizontal"
      aria-label={t.editor.zeitHoehe}
      title={t.editor.zeitHoeheHinweis}
      tabIndex={0}
      data-testid="zeit-teiler"
      onPointerDown={(e) => {
        const start = e.currentTarget.parentElement!.getBoundingClientRect().height;
        const y0 = e.clientY;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => speichere(begrenze(start + (y0 - ev.clientY)));
        const ende = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', ende);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', ende);
      }}
      onDoubleClick={() => speichere(null)}
      onKeyDown={(e) => {
        const aktuell = hoehe ?? e.currentTarget.parentElement!.getBoundingClientRect().height;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          speichere(begrenze(aktuell + 24));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          speichere(begrenze(aktuell - 24));
        } else if (e.key === 'Home') speichere(null);
      }}
    />
  );
}

const SEITE_KEY = 'bdva-seite-breite';
export function leseSeitenBreite(): number | null {
  try {
    const v = Number(localStorage.getItem(SEITE_KEY));
    return v >= 280 && v <= 900 ? v : null;
  } catch {
    return null;
  }
}

/** Griff am linken Rand der Seitenleiste: Ziehen (oder Pfeil links/rechts) ändert die Breite, Doppelklick = Standard. */
function SeitenTeiler({
  breite,
  setze,
}: {
  breite: number | null;
  setze: (b: number | null) => void;
}) {
  const speichere = (b: number | null) => {
    setze(b);
    try {
      if (b) localStorage.setItem(SEITE_KEY, String(Math.round(b)));
      else localStorage.removeItem(SEITE_KEY);
    } catch {
      /* egal */
    }
  };
  const begrenze = (b: number) => Math.round(Math.min(window.innerWidth * 0.7, Math.max(280, b)));
  return (
    <div
      className={s.seitenTeiler}
      role="separator"
      aria-orientation="vertical"
      aria-label={t.editor.seitenBreite}
      title={t.editor.seitenBreiteHinweis}
      tabIndex={0}
      data-testid="seiten-teiler"
      onPointerDown={(e) => {
        const start = e.currentTarget.parentElement!.getBoundingClientRect().width;
        const x0 = e.clientX;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => speichere(begrenze(start + (x0 - ev.clientX)));
        const ende = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', ende);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', ende);
      }}
      onDoubleClick={() => speichere(null)}
      onKeyDown={(e) => {
        const aktuell = breite ?? e.currentTarget.parentElement!.getBoundingClientRect().width;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          speichere(begrenze(aktuell + 24));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          speichere(begrenze(aktuell - 24));
        } else if (e.key === 'Home') speichere(null);
      }}
    />
  );
}
