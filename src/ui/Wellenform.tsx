import { wellenformPfad } from '../audio/wellenform';

/** Gespiegelte Wellenform als skalierbares SVG; füllt das umgebende (relativ positionierte) Element. */
export function Wellenform({
  peaks,
  proSekunde,
  von,
  bis,
  farbe = 'rgba(255,255,255,0.85)',
}: {
  peaks: ArrayLike<number> | null | undefined;
  proSekunde: number;
  von: number;
  bis: number;
  farbe?: string;
}) {
  if (!peaks || peaks.length === 0 || bis <= von) return null;
  const { d, n } = wellenformPfad(peaks, proSekunde, von, bis);
  return (
    <svg
      viewBox={`0 0 ${Math.max(1, n - 1)} 2`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="wellenform"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <path d={d} fill={farbe} />
    </svg>
  );
}
