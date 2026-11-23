import { useEffect, useState } from 'react';
import { dateiKey } from '../db/projekte';
import type { Clip, Quelle } from '../model/typen';
import { useDateien } from '../store/dateien';
import { holeEinzelbild } from '../video/thumbs';

/** Vorschaubild eines Clips (Bild am Clip-Anfang), im Worker erzeugt und gecacht. */
export function ClipVorschau({ clip, quelle }: { clip: Clip; quelle?: Quelle }) {
  const datei = useDateien((d) => (quelle ? d.dateien[quelle.id] : undefined));
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!quelle || !datei) return;
    let weg = false;
    let u: string | null = null;
    // kleine Verzögerung: schnelle Scroll-/Listenwechsel lösen keine unnötigen Aufträge aus
    const tm = setTimeout(() => {
      void holeEinzelbild(
        dateiKey(quelle),
        datei,
        Math.min(clip.in + 0.1, quelle.dauer - 0.05),
      ).then((b) => {
        if (weg || !b) return;
        u = URL.createObjectURL(b);
        setUrl(u);
      });
    }, 150);
    return () => {
      weg = true;
      clearTimeout(tm);
      if (u) URL.revokeObjectURL(u);
    };
  }, [quelle, datei, clip.in]);
  return (
    <span
      aria-hidden="true"
      style={{
        width: 80,
        height: 45,
        flex: 'none',
        background: 'var(--bd-black)',
        display: 'inline-block',
      }}
    >
      {url && (
        <img
          src={url}
          alt=""
          style={{ width: 80, height: 45, objectFit: 'cover', display: 'block' }}
        />
      )}
    </span>
  );
}
