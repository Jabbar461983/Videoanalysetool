/**
 * Tippt der Nutzer gerade in ein Eingabefeld? Funktioniert auch für Elemente in ausgelagerten Fenstern:
 * `instanceof HTMLElement` wäre dort falsch, weil jedes Fenster seine eigenen Klassen hat.
 */
export function istEingabeFeld(ziel: EventTarget | null | undefined): boolean {
  const el = ziel as { tagName?: unknown; isContentEditable?: unknown } | null | undefined;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}
