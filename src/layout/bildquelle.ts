/**
 * Register des Videoelements der Bühne. Liegt die Bühne in einem ausgelagerten Fenster, findet
 * `document.querySelector('video')` im Hauptfenster nichts mehr. Alle Stellen, die «das» Video brauchen, fragen hier.
 */
let hauptVideo: HTMLVideoElement | null = null;

export function setzeHauptVideo(el: HTMLVideoElement | null): void {
  hauptVideo = el;
}

/** Abmelden nur, wenn noch dasselbe Element eingetragen ist (beim Umzug in ein anderes Fenster meldet die neue Bühne sich oft vor der alten ab). */
export function loescheHauptVideo(el: HTMLVideoElement | null): void {
  if (hauptVideo === el) hauptVideo = null;
}

export function holeHauptVideo(): HTMLVideoElement | null {
  return hauptVideo ?? (typeof document !== 'undefined' ? document.querySelector('video') : null);
}

// Nur für automatische Tests
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('bdva-test') === '1')
    (window as unknown as Record<string, unknown>).__bdvaHauptVideo = holeHauptVideo;
} catch {
  /* egal */
}
