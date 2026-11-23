import { useState } from 'react';
import { t } from '../i18n/de-CH';
import { dateiKey } from '../db/projekte';
import { ordneDateienZu } from '../projektdatei/zuordnung';
import { useDateien } from '../store/dateien';
import { useProjekt } from '../store/projektStore';
import { speichereHandle, waehleVideos } from '../video/handles';

/** Hinweis im Editor, wenn Videodateien fehlen (nach Neuladen oder Projektimport): mehrere Dateien auf einmal zuordnen. */
export function QuellenBanner() {
  const projekt = useProjekt((x) => x.projekt);
  const dateien = useDateien((d) => d.dateien);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  if (!projekt) return null;
  const fehlend = projekt.quellen.filter((q) => !dateien[q.id]);
  if (fehlend.length === 0) return null;

  const zuordnen = async () => {
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      const auswahl = await waehleVideos(true);
      if (auswahl.length === 0) return;
      const r = await ordneDateienZu(
        fehlend,
        auswahl.map((a) => a.datei),
      );
      for (const z of r.zugeordnet) {
        useDateien.getState().setze(z.quelleId, z.datei);
        const q = fehlend.find((x) => x.id === z.quelleId);
        const h = auswahl.find((a) => a.datei === z.datei)?.handle;
        if (q && h) await speichereHandle(dateiKey(q), h);
      }
      const noch = fehlend.length - r.zugeordnet.length;
      setMeldung(
        r.zugeordnet.length === 0
          ? t.banner.keineTreffer
          : noch > 0
            ? t.banner.teilweise(r.zugeordnet.length, noch)
            : null,
      );
    } finally {
      setBeschaeftigt(false);
    }
  };

  return (
    <div
      role="status"
      data-testid="quellen-banner"
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '6px 12px',
        background: '#2a2410',
        borderBottom: '1px solid var(--bd-gold)',
      }}
    >
      <span>
        <strong style={{ color: 'var(--bd-gold)' }}>{t.banner.titel(fehlend.length)}</strong>{' '}
        <span className="hinweis">{fehlend.map((q) => `${q.dateiname}`).join(', ')}</span>
      </span>
      <button
        className="primaer"
        data-testid="banner-zuordnen"
        disabled={beschaeftigt}
        onClick={() => void zuordnen()}
      >
        {t.banner.zuordnen}
      </button>
      {meldung && <span className="hinweis">{meldung}</span>}
    </div>
  );
}
