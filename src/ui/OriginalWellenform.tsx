import { useEffect, useState } from 'react';
import { dateiKey } from '../db/projekte';
import { peaksAusQuelle } from '../audio/peaks';
import type { Clip, Quelle } from '../model/typen';
import { useDateien } from '../store/dateien';
import type { Segment } from '../wiedergabe/zeitachse';
import { Wellenform } from './Wellenform';

const PRO_SEK = 50;

/** Wellenform des Originaltons im Clip: nur Video-Segmente (Standbilder sind stumm), Zeitlupe gedehnt. */
export function OriginalWellenform({
  clip,
  quelle,
  segmente,
  dauer,
}: {
  clip: Clip;
  quelle: Quelle | undefined;
  segmente: Segment[];
  dauer: number;
}) {
  const datei = useDateien((d) => (quelle ? d.dateien[quelle.id] : undefined));
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  useEffect(() => {
    setPeaks(null);
    if (!quelle || !datei) return;
    let weg = false;
    void peaksAusQuelle(dateiKey(quelle), datei, clip.in, clip.out, PRO_SEK).then((p) => {
      if (!weg) setPeaks(p);
    });
    return () => {
      weg = true;
    };
  }, [quelle, datei, clip.in, clip.out]);
  return (
    <>
      {segmente
        .filter((s) => s.art === 'video' && clip.quelleId === s.quelleId)
        .map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(s.start / dauer) * 100}%`,
              width: `${(s.dauer / dauer) * 100}%`,
              overflow: 'hidden',
            }}
          >
            <Wellenform
              peaks={peaks}
              proSekunde={PRO_SEK}
              von={s.von! - clip.in}
              bis={s.bis! - clip.in}
              farbe="rgba(255,255,255,0.8)"
            />
          </div>
        ))}
    </>
  );
}
