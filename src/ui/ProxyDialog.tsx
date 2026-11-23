import { useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import type { Quelle } from '../model/typen';
import { erzeugeProxy, type ProxyHandle } from '../proxy/ffmpegProxy';
import { useDateien } from '../store/dateien';
import { useProjekt } from '../store/projektStore';

export function ProxyDialog({ quelle, onZu }: { quelle: Quelle; onZu: () => void }) {
  const [phase, setPhase] = useState<'bereit' | 'laedt' | 'laeuft' | 'fertig' | 'fehler'>('bereit');
  const [prozent, setProzent] = useState(0);
  const h = useRef<ProxyHandle | null>(null);
  const datei = useDateien((d) => d.dateien[quelle.id]);

  const start = async () => {
    if (!datei) return;
    setPhase('laedt');
    h.current = erzeugeProxy(datei, quelle.dauer, (p, pr) => {
      setPhase(p);
      setProzent(pr);
    });
    try {
      const id = await h.current.fertig;
      useProjekt.getState().aendere('Proxy-Datei', (p) => {
        const q = p.quellen.find((x) => x.id === quelle.id);
        if (q) q.proxyId = id;
      });
      const aktuell = useProjekt.getState().projekt?.quellen.find((x) => x.id === quelle.id);
      if (aktuell) await useDateien.getState().versuche(aktuell, false);
      setPhase('fertig');
    } catch {
      setPhase('fehler');
    }
  };
  const abbrechen = () => {
    h.current?.abbrechen();
    onZu();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="px-t"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--bd-surface-raised)',
          border: '1px solid var(--bd-rule)',
          padding: 24,
          maxWidth: 520,
        }}
      >
        <h2 id="px-t" style={{ fontSize: 18, marginBottom: 12 }}>
          {t.proxy.titel}
        </h2>
        <p>{t.proxy.erklaerung}</p>
        {quelle.groesse > 2 * 1024 ** 3 && <p className="hinweis">{t.proxy.speicherWarnung}</p>}
        {phase === 'laedt' && <p role="status">{t.proxy.laedt}</p>}
        {phase === 'laeuft' && <p role="status">{t.proxy.laeuft(prozent)}</p>}
        {phase === 'fertig' && <p role="status">{t.proxy.fertig}</p>}
        {phase === 'fehler' && <p role="alert">{t.proxy.fehler}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {(phase === 'bereit' || phase === 'fehler') && (
            <button className="primaer" onClick={() => void start()} disabled={!datei}>
              {t.proxy.start}
            </button>
          )}
          <button onClick={phase === 'laeuft' || phase === 'laedt' ? abbrechen : onZu}>
            {phase === 'fertig' ? t.dialog.ok : t.proxy.abbrechen}
          </button>
        </div>
      </div>
    </div>
  );
}
