import type { IDockviewHeaderActionsProps } from 'dockview-react';
import { t } from '../i18n/de-CH';
import { fensterMoeglich, oeffneInFenster } from './popout';
import s from './layout.module.css';

/** Knöpfe rechts im Kopf jeder Gruppe: in eigenes Fenster auslagern, auf zweiten Bildschirm, zurückholen, Vollbild. */
export function KopfAktionen(p: IDockviewHeaderActionsProps) {
  const popout = p.location?.type === 'popout';
  const enthaeltVideo = p.panels.some((x) => x.id === 'buehne');
  const id = p.activePanel?.id ?? 'gruppe';

  if (popout) {
    const fenster = p.api.getWindow();
    return (
      <div className={s.aktionen}>
        <button
          className={s.aktion}
          data-testid={`fenster-vollbild-${id}`}
          title={t.layout.vollbild}
          onClick={() => {
            const d = fenster.document;
            if (d.fullscreenElement) void d.exitFullscreen().catch(() => {});
            else void d.documentElement.requestFullscreen().catch(() => {});
          }}
        >
          {t.layout.vollbild}
        </button>
        <button
          className={s.aktion}
          data-testid={`fenster-zurueck-${id}`}
          title={t.layout.zurueckHolen}
          onClick={() => fenster.close()}
        >
          {t.layout.zurueckHolen}
        </button>
      </div>
    );
  }
  if (!fensterMoeglich()) return null;
  return (
    <div className={s.aktionen}>
      {enthaeltVideo && (
        <button
          className={s.aktion}
          data-testid={`fenster-zweiter-${id}`}
          title={t.layout.zweiterBildschirm}
          onClick={() => void oeffneInFenster(p.containerApi, p.group, true)}
        >
          {t.layout.zweiterBildschirmKurz}
        </button>
      )}
      <button
        className={s.aktion}
        data-testid={`fenster-popout-${id}`}
        title={t.layout.eigenesFenster}
        aria-label={t.layout.eigenesFenster}
        onClick={() => void oeffneInFenster(p.containerApi, p.group, false)}
      >
        ↗
      </button>
    </div>
  );
}
