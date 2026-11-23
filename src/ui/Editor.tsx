import { useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { ladeProjekt, dateiKey } from '../db/projekte';
import { useProjekt } from '../store/projektStore';
import { starteAutosave } from '../store/autosave';
import { useDateien } from '../store/dateien';
import { Streifen } from './Streifen';
import { Buehne } from './Buehne';
import { Timeline } from './Timeline';
import { Quellenpanel } from './Quellenpanel';
import { HotkeyHilfe } from './HotkeyHilfe';
import { useEditorTasten } from './tasten';
import s from './Editor.module.css';

export function Editor({ projektId }: { projektId: string }) {
  const projekt = useProjekt((x) => x.projekt);
  const status = useProjekt((x) => x.status);
  const [fehlt, setFehlt] = useState(false);

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
    <div className={s.app}>
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
        <Buehne quelle={q} />
      </section>
      <aside className={s.seite} aria-label={t.editor.seitenleiste}>
        <Quellenpanel />
        <p className="hinweis" style={{ marginTop: 24 }}>
          {t.editor.seitenleisteLeer}
        </p>
      </aside>
      <section className={s.zeit}>
        <Timeline quelle={q} schluessel={q ? dateiKey(q) : ''} />
      </section>
      <HotkeyHilfe />
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
