/**
 * Fensterregister: Neben dem Hauptfenster kann die App weitere Fenster haben (ausgelagerte Module, Beamer-Fenster).
 * Ereignisse wie Tastendrücke sollen in allen Fenstern gelten: `aufAllenFenstern` hängt einen Listener an jedes
 * registrierte Fenster, auch an später geöffnete.
 */
export type FensterLike = Pick<Window, 'addEventListener' | 'removeEventListener'>;

interface Abo {
  typ: string;
  fn: (e: never) => void;
  opts?: boolean | AddEventListenerOptions;
}

const fenster = new Set<FensterLike>();
const abos = new Set<Abo>();
if (typeof window !== 'undefined') fenster.add(window);

export function alleFenster(): FensterLike[] {
  return [...fenster];
}

/** Meldet ein weiteres Fenster an. Gibt die Abmeldung zurück (beim Schliessen aufrufen). */
export function registriereFenster(w: FensterLike): () => void {
  if (fenster.has(w)) return () => {};
  fenster.add(w);
  for (const a of abos) w.addEventListener(a.typ, a.fn as EventListener, a.opts);
  return () => {
    if (!fenster.delete(w)) return;
    for (const a of abos) w.removeEventListener(a.typ, a.fn as EventListener, a.opts);
  };
}

/** Wie `window.addEventListener`, aber in allen (auch später angemeldeten) Fenstern. Gibt die Abmeldung zurück. */
export function aufAllenFenstern<K extends keyof WindowEventMap>(
  typ: K,
  fn: (e: WindowEventMap[K]) => void,
  opts?: boolean | AddEventListenerOptions,
): () => void {
  const abo: Abo = { typ, fn: fn as (e: never) => void, opts };
  abos.add(abo);
  for (const w of fenster) w.addEventListener(typ, fn as EventListener, opts);
  return () => {
    abos.delete(abo);
    for (const w of fenster) w.removeEventListener(typ, fn as EventListener, opts);
  };
}

/** Das Fenster, in dem ein Element gerade liegt (Haupt- oder ausgelagertes Fenster). */
export function fensterVon(el: Element | null | undefined): Window {
  return el?.ownerDocument?.defaultView ?? window;
}
