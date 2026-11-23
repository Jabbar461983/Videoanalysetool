/** Gold-grüner Doppelstreifen (je 30 px, skewX(-8deg), Gold innen, Grün aussen). */
export function Streifen({ hoehe = 24 }: { hoehe?: number }) {
  const s = { width: 30, height: hoehe, transform: 'skewX(-8deg)' } as const;
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', gap: 0 }}>
      <span style={{ ...s, background: 'var(--bd-green)' }} />
      <span style={{ ...s, background: 'var(--bd-gold)' }} />
    </span>
  );
}
