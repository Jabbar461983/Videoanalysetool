import { useEffect, useRef } from 'react';
import { DockviewReact, type DockviewReadyEvent } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { useLayout } from '../store/layout';
import { useProgramm } from '../store/programm';
import { useUi, type SeitenTab } from '../store/ui';
import { KOMPONENTEN, ModulTab } from './panels';
import { ladeLayout, speichereLayout } from './speicher';
import { baueStandardLayout, SEITEN_MODULE } from './standard';
import './layout.css';

const TAB_MODULE = new Set<string>(SEITEN_MODULE);

/**
 * Die frei anpassbare Arbeitsfläche: Module (Video, Tag-Leiste, Zeitleiste, Register) lassen sich in der Grösse ändern,
 * verschieben, andocken, zu Registern gruppieren und schweben lassen. Das Layout wird pro Gerät gemerkt.
 */
export function Arbeitsflaeche() {
  const praesi = useUi((u) => u.praesentation);
  const host = useRef<HTMLDivElement>(null);

  const bereit = (e: DockviewReadyEvent) => {
    const api = e.api;
    const b = host.current?.getBoundingClientRect();
    const gespeichert = ladeLayout();
    let ok = false;
    if (gespeichert) {
      try {
        api.fromJSON(gespeichert);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok)
      baueStandardLayout(api, b?.width ?? window.innerWidth, b?.height ?? window.innerHeight);

    let timer = 0;
    api.onDidLayoutChange(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => speichereLayout(api.toJSON()), 400);
    });
    // Aktives Register ↔ Zustand der Anwendung (andere Stellen schalten Register per `setzeTab`)
    api.onDidActivePanelChange((e) => {
      const p = e.panel;
      if (p && TAB_MODULE.has(p.id)) useUi.getState().setzeTab(p.id as SeitenTab);
    });
    useLayout.getState().setzeApi(api);
    try {
      if (localStorage.getItem('bdva-test') === '1')
        (window as unknown as Record<string, unknown>).__bdvaLayout = api;
    } catch {
      /* egal */
    }
  };

  // Andere Stellen der App wählen ein Register (z. B. «Clips» nach dem Schneiden)
  const tab = useUi((u) => u.tab);
  const api = useLayout((l) => l.api);
  useEffect(() => {
    const p = api?.getPanel(tab);
    if (p && !p.api.isActive) p.api.setActive();
  }, [api, tab]);

  // Präsentation im selben Fenster: nur die Bühne, bildschirmfüllend
  useEffect(() => {
    if (!api) return;
    const buehne = api.getPanel('buehne');
    if (praesi && buehne) {
      buehne.api.setActive();
      if (!api.hasMaximizedGroup()) api.maximizeGroup(buehne);
    } else if (!praesi && api.hasMaximizedGroup()) api.exitMaximizedGroup();
  }, [api, praesi]);

  // Tag-Leiste gibt es nur in der Quellansicht: sonst auf die Kopfzeile einklappen und Platz fürs Video freigeben
  const art = useProgramm((g) => g.art);
  const tagHoehe = useRef<number | null>(null);
  useEffect(() => {
    const g = api?.getPanel('taglesite')?.group;
    if (!g) return;
    const MIN = 100; // Standard-Mindesthöhe einer Gruppe in Dockview
    if (art !== 'quelle') {
      if (tagHoehe.current === null) tagHoehe.current = g.api.height;
      g.api.setConstraints({ minimumHeight: 32, maximumHeight: 32 });
      g.api.setSize({ height: 32 });
    } else if (tagHoehe.current !== null) {
      g.api.setConstraints({ minimumHeight: MIN, maximumHeight: Number.MAX_SAFE_INTEGER });
      g.api.setSize({ height: tagHoehe.current });
      tagHoehe.current = null;
    }
  }, [api, art]);

  useEffect(
    () => () => {
      useLayout.getState().setzeApi(null);
    },
    [],
  );

  return (
    <div
      ref={host}
      className="bd-dock-host"
      data-praesi={praesi}
      style={{ height: '100%', minHeight: 0 }}
    >
      <DockviewReact
        className="dockview-theme-dark bd-dock"
        components={KOMPONENTEN}
        defaultTabComponent={ModulTab}
        onReady={bereit}
        singleTabMode="default"
      />
    </div>
  );
}
