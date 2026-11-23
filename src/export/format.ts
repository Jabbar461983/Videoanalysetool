/** Reine Hilfsfunktionen für den Export (testbar ohne Browser). */

export type ExportAufloesung = 720 | 1080;

const gerade = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Ausgabegrösse: Seitenverhältnis der Quelle, höchstens 1920×1080 bzw. 1280×720, nie hochskaliert, gerade Werte.
 * (4K wird auf 1080p herunterskaliert; Hochformat passt in dasselbe Rechteck.)
 */
export function ausgabeGroesse(
  quelleB: number,
  quelleH: number,
  aufloesung: ExportAufloesung,
): { breite: number; hoehe: number } {
  const maxB = aufloesung === 1080 ? 1920 : 1280;
  const maxH = aufloesung === 1080 ? 1080 : 720;
  const f = Math.min(1, maxB / quelleB, maxH / quelleH);
  return { breite: gerade(quelleB * f), hoehe: gerade(quelleH * f) };
}

/** Bildrate der Quelle, höchstens 60, mindestens 1; unsinnige Werte → 25. */
export function exportFps(quelleFps: number): number {
  if (!Number.isFinite(quelleFps) || quelleFps < 1) return 25;
  return Math.min(60, Math.round(quelleFps * 1000) / 1000);
}

/** Automatische Bitrate (bit/s): ~0.08 bit pro Pixel und Bild für H.264, begrenzt 1.5–20 Mbit/s. */
export function exportBitrate(breite: number, hoehe: number, fps: number): number {
  const b = breite * hoehe * fps * 0.08;
  return Math.round(Math.min(20_000_000, Math.max(1_500_000, b)));
}

export const frameAnzahl = (dauer: number, fps: number): number =>
  Math.max(1, Math.round(dauer * fps));

/** Zeitstempel (Quellzeit) für das Ausgabebild `i` in einem Video-Segment; bleibt im Segment. */
export function quellZeitFuerFrame(
  i: number,
  fps: number,
  seg: { start: number; von: number; bis: number; tempo: number },
): number {
  const lokal = Math.max(0, i / fps - seg.start);
  const z = seg.von + lokal * seg.tempo;
  return Math.min(Math.max(seg.von, z), Math.max(seg.von, seg.bis - 0.001));
}

/** Verbleibende Zeit in Sekunden aus Fortschritt (0–1) und bisher verstrichener Zeit; `null`, solange unklar. */
export function restzeit(fortschritt: number, verstricheneSek: number): number | null {
  if (fortschritt < 0.02 || verstricheneSek < 1) return null;
  return (verstricheneSek / fortschritt) * (1 - fortschritt);
}

export function formatDauer(sek: number): string {
  const s = Math.max(0, Math.round(sek));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m % 60)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;
}

/** Dateiname ohne Sonderzeichen (Windows/macOS-tauglich). */
export function dateiName(...teile: string[]): string {
  const roh = teile
    .filter(Boolean)
    .join(' - ')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (roh || 'Export').slice(0, 120);
}

/** Wahl der Codecs aus dem, was der Browser kodieren kann. */
export function waehleCodecs(kann: { avc: boolean; vp9: boolean; aac: boolean; opus: boolean }): {
  video: 'avc' | 'vp9' | null;
  audio: 'aac' | 'opus' | null;
  hinweise: string[];
} {
  const hinweise: string[] = [];
  const video = kann.avc ? 'avc' : kann.vp9 ? 'vp9' : null;
  const audio = kann.aac ? 'aac' : kann.opus ? 'opus' : null;
  if (video === 'vp9')
    hinweise.push(
      'Dieser Browser kann kein H.264 kodieren: Es wird VP9 verwendet (läuft in VLC und Browsern, nicht überall).',
    );
  if (audio === 'opus')
    hinweise.push(
      'Dieser Browser kann kein AAC kodieren: Es wird Opus verwendet (läuft in VLC und Browsern, QuickTime evtl. ohne Ton).',
    );
  return { video, audio, hinweise };
}
