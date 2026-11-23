import { useEffect, useState, type RefObject } from 'react';
import { segmentAendern } from '../audio/aktionen';
import { PEAKS_PRO_SEKUNDE } from '../audio/peaks';
import { holeAudioRow } from '../audio/speicher';
import type { AudioSegment, KommentarSpur } from '../model/typen';
import { Wellenform } from './Wellenform';
import { ZeitBalken } from './ZeitBalken';

const peaksCache = new Map<string, Float32Array>();

/** Ein Kommentar-Segment in der Zeitleiste: Wellenform, Ziehen verschiebt, Ränder kürzen. */
export function KommentarBalken({
  clipId,
  spur,
  seg,
  dauer,
  spurRef,
}: {
  clipId: string;
  spur: KommentarSpur;
  seg: AudioSegment;
  dauer: number;
  spurRef: RefObject<HTMLDivElement | null>;
}) {
  const [peaks, setPeaks] = useState<Float32Array | null>(peaksCache.get(seg.blobId) ?? null);
  useEffect(() => {
    if (peaksCache.has(seg.blobId)) return setPeaks(peaksCache.get(seg.blobId)!);
    let weg = false;
    void holeAudioRow(seg.blobId).then((r) => {
      if (!r) return;
      peaksCache.set(seg.blobId, r.peaks);
      if (!weg) setPeaks(r.peaks);
    });
    return () => {
      weg = true;
    };
  }, [seg.blobId]);
  return (
    <ZeitBalken
      start={seg.start}
      ende={seg.start + seg.dauer}
      dauer={dauer}
      spurRef={spurRef}
      top={2}
      hoehe={22}
      farbe={spur.stumm ? '#4a4a4a' : 'rgba(47,128,237,0.65)'}
      textfarbe="#fff"
      label=""
      aria={`${spur.name}`}
      testid="kommentar-balken"
      kantenTestid="kommentar"
      minLaenge={0.1}
      onCommit={(st, en) => void segmentAendern(clipId, seg.id, st, en)}
    >
      <Wellenform
        peaks={peaks}
        proSekunde={PEAKS_PRO_SEKUNDE}
        von={seg.offset}
        bis={seg.offset + seg.dauer}
      />
    </ZeitBalken>
  );
}
