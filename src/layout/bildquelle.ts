/**
 * Register des Videoelements der Bühne. Liegt die Bühne in einem ausgelagerten Fenster, findet
 * `document.querySelector('video')` im Hauptfenster nichts mehr. Alle Stellen, die «das» Video brauchen, fragen hier.
 */
let hauptVideo: HTMLVideoElement | null = null;

export function setzeHauptVideo(el: HTMLVideoElement | null): void {
  hauptVideo = el;
}

export function holeHauptVideo(): HTMLVideoElement | null {
  return hauptVideo ?? (typeof document !== 'undefined' ? document.querySelector('video') : null);
}
