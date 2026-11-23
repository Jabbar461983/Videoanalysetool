/**
 * SVG-Pfad (viewBox `0 0 n 2`, Mitte bei y = 1) einer gespiegelten Wellenform aus Spitzen.
 * `von`/`bis` in Sekunden relativ zum Anfang der Spitzenliste (`proSekunde` je Sekunde), höchstens `maxPunkte`.
 */
export function wellenformPfad(
  peaks: ArrayLike<number>,
  proSekunde: number,
  von: number,
  bis: number,
  maxPunkte = 300,
): { d: string; n: number } {
  const a = Math.max(0, Math.floor(von * proSekunde));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(bis * proSekunde)));
  const anzahl = Math.max(1, b - a);
  const n = Math.min(maxPunkte, anzahl);
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = a + Math.floor((i * anzahl) / n);
    const e = a + Math.max(Math.floor(((i + 1) * anzahl) / n), Math.floor((i * anzahl) / n) + 1);
    let m = 0;
    for (let k = s; k < Math.min(e, peaks.length); k++) m = Math.max(m, peaks[k] ?? 0);
    vals.push(Math.min(1, m));
  }
  const oben = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${i},${(1 - v).toFixed(3)}`);
  const unten = vals.map((_, i) => `L${n - 1 - i},${(1 + vals[n - 1 - i]!).toFixed(3)}`);
  return { d: `${oben.join('')}${unten.join('')}Z`, n };
}
