export const KUERZEL_RE = /^[A-ZÄÖÜ]{3}$/;

/** Wandelt Eingabe in ein gültiges Kürzel-Format (Grossbuchstaben, max. 3). */
export const normalisiereKuerzel = (s: string): string =>
  s
    .toLocaleUpperCase('de-CH')
    .replace(/[^A-ZÄÖÜ]/g, '')
    .slice(0, 3);

export const istGueltigesKuerzel = (s: string): boolean => KUERZEL_RE.test(s);

/** Prüft den Hotkey eines Tags: ein Zeichen, nicht reserviert, nicht doppelt. */
export function pruefeHotkey(
  hotkey: string | undefined,
  eigeneId: string,
  andere: { id: string; hotkey?: string }[],
  reserviert: readonly string[],
): 'ok' | 'reserviert' | 'doppelt' | 'ungueltig' {
  if (!hotkey) return 'ok';
  if (hotkey.length !== 1) return 'ungueltig';
  const h = hotkey.toUpperCase();
  if (reserviert.includes(h)) return 'reserviert';
  if (andere.some((a) => a.id !== eigeneId && a.hotkey?.toUpperCase() === h)) return 'doppelt';
  return 'ok';
}
