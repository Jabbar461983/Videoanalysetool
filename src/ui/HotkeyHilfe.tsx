import { useEffect, useState } from 'react';
import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { aufAllenFenstern } from '../layout/fenster';

export function HotkeyHilfe() {
  const defs = useProjekt((x) => x.projekt?.tagDefinitionen ?? []);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName))
        return;
      if (e.key === '?') setOffen((o) => !o);
      if (e.key === 'Escape') setOffen(false);
    };
    return aufAllenFenstern('keydown', h);
  }, []);
  if (!offen) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.hotkeys.titel}
      onClick={() => setOffen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 90,
      }}
    >
      <div
        style={{
          background: 'var(--bd-surface-raised)',
          border: '1px solid var(--bd-rule)',
          padding: 24,
          maxWidth: 480,
        }}
      >
        <p className="kicker">{t.hotkeys.titel}</p>
        {[
          t.hotkeys.leertaste,
          t.hotkeys.pfeile,
          t.hotkeys.sprung,
          t.hotkeys.tempo,
          t.hotkeys.undo,
          t.hotkeys.overlay,
          t.hotkeys.tagging,
          t.hotkeys.zeichnen,
          t.hotkeys.praesentation,
        ].map((z) => (
          <p key={z}>{z}</p>
        ))}
        <p className="hinweis">
          {defs
            .filter((d) => d.hotkey)
            .map((d) => `${d.hotkey} ${d.name}`)
            .join(' · ')}
        </p>
      </div>
    </div>
  );
}
