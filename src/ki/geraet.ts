/** Wahl des KI-Rechners: «auto» nutzt WebGPU, wenn möglich; «wasm» erzwingt den Prozessor (z. B. bei Grafikproblemen). */
const SCHLUESSEL = 'bdva-ki-geraet';

export type KiGeraet = 'auto' | 'wasm';

export function leseKiGeraet(): KiGeraet {
  try {
    return localStorage.getItem(SCHLUESSEL) === 'wasm' ? 'wasm' : 'auto';
  } catch {
    return 'auto';
  }
}

export function setzeKiGeraet(g: KiGeraet): void {
  try {
    if (g === 'wasm') localStorage.setItem(SCHLUESSEL, 'wasm');
    else localStorage.removeItem(SCHLUESSEL);
  } catch {
    /* egal */
  }
}
