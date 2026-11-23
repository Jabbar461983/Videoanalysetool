/** Vereinslogo für die Vorschau: PNG, sonst SVG-Platzhalter. Der Export reicht sein Bitmap über `ziel.logo`. */
export interface LogoBild {
  bild: CanvasImageSource;
  breite: number;
  hoehe: number;
  platzhalter: boolean;
}

let aktuell: LogoBild | null = null;
let laedt: Promise<LogoBild | null> | null = null;
const hoerer = new Set<() => void>();

const basis = (): string => (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/');

function ladeBild(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.naturalWidth > 0 ? resolve(img) : reject(new Error('leer')));
    img.onerror = () => reject(new Error('nicht ladbar'));
    img.src = url;
  });
}

/** Lädt einmalig und informiert Zuhörer (damit die Vorschau neu zeichnet). */
export function ladeLogo(): Promise<LogoBild | null> {
  laedt ??= (async () => {
    for (const [datei, platzhalter] of [
      ['brand/logo-bulldozers.png', false],
      ['brand/logo-platzhalter.svg', true],
    ] as const) {
      try {
        const img = await ladeBild(`${basis()}${datei}`);
        aktuell = {
          bild: img,
          breite: img.naturalWidth || 200,
          hoehe: img.naturalHeight || 120,
          platzhalter,
        };
        hoerer.forEach((f) => f());
        return aktuell;
      } catch {
        /* nächster Kandidat */
      }
    }
    return null;
  })();
  return laedt;
}

/** Bereits geladenes Logo (oder `null`, bis es geladen ist). Stösst das Laden an. */
export function holeLogo(): LogoBild | null {
  if (!aktuell) void ladeLogo();
  return aktuell;
}

export function beiLogoGeladen(f: () => void): () => void {
  hoerer.add(f);
  return () => hoerer.delete(f);
}
