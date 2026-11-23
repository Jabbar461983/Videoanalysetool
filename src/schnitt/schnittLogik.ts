import type { Clip, Playlist, PlaylistEintrag, Projekt, Quelle, Uebergang } from '../model/typen';
import { neueId } from '../model/schema';
import { formatZeit } from '../video/bildmathe';
import {
  dupliziereZeichnungen,
  entferneZeichnungenVonClip,
  mitZeichnungsAbgleich,
} from '../zeichnen/logik';

export const MIN_CLIP_DAUER = 0.5;
const runde = (x: number) => Math.round(x * 1000) / 1000;

/** Rundet auf Bildgrenzen der Quelle. */
export const aufBild = (t: number, fps: number): number => runde(Math.round(t * fps) / fps);

export function neuerClip(
  quelle: Pick<Quelle, 'id' | 'dauer' | 'fps'>,
  von: number,
  bis: number,
  name?: string,
): Clip | null {
  const a = aufBild(Math.min(von, bis), quelle.fps);
  const b = aufBild(Math.max(von, bis), quelle.fps);
  const aa = Math.max(0, a);
  const bb = Math.min(quelle.dauer, b);
  if (bb - aa < MIN_CLIP_DAUER) return null;
  return {
    id: neueId(),
    quelleId: quelle.id,
    in: aa,
    out: bb,
    name: name ?? `Clip ${formatZeit(aa, quelle.fps)}`,
    freezeFrames: [],
    zeitlupen: [],
  };
}

/** Setzt In oder Out; hält Mindestlänge und entfernt Freeze/Zeitlupen ausserhalb des neuen Bereichs. */
export function trimmeClip(
  clip: Clip,
  seite: 'in' | 'out',
  zeit: number,
  quelle: Pick<Quelle, 'dauer' | 'fps'>,
): boolean {
  const t = aufBild(zeit, quelle.fps);
  if (seite === 'in') {
    if (t < 0 || clip.out - t < MIN_CLIP_DAUER) return false;
    clip.in = t;
  } else {
    if (t > quelle.dauer || t - clip.in < MIN_CLIP_DAUER) return false;
    clip.out = t;
  }
  bereinigeClip(clip);
  return true;
}

/** Entfernt/kürzt Freeze-Frames und Zeitlupen, die nach dem Trimmen ausserhalb liegen. */
export function bereinigeClip(clip: Clip): void {
  clip.freezeFrames = clip.freezeFrames.filter((f) => f.zeit >= clip.in && f.zeit <= clip.out);
  clip.zeitlupen = clip.zeitlupen
    .map((z) => ({ ...z, von: Math.max(z.von, clip.in), bis: Math.min(z.bis, clip.out) }))
    .filter((z) => z.bis - z.von > 0.04);
}

export function dupliziereClip(p: Projekt, clipId: string, suffix = ' (Kopie)'): string | null {
  const i = p.clips.findIndex((c) => c.id === clipId);
  const c = p.clips[i];
  if (!c) return null;
  const kopie: Clip = JSON.parse(JSON.stringify(c)) as Clip; // structuredClone kann keine Immer-Entwürfe kopieren
  kopie.id = neueId();
  kopie.name = c.name + suffix;
  delete kopie.tagId; // eigenständig: Tag löschen darf die Kopie nicht mitnehmen
  p.clips.splice(i + 1, 0, kopie);
  dupliziereZeichnungen(p, clipId, kopie.id);
  return kopie.id;
}

/** Löscht einen Clip und alle Playlist-Einträge, die auf ihn zeigen. */
export function entferneClip(p: Projekt, clipId: string): void {
  p.clips = p.clips.filter((c) => c.id !== clipId);
  entferneZeichnungenVonClip(p, clipId);
  for (const pl of p.playlisten) {
    pl.eintraege = pl.eintraege.filter((e) => !(e.typ === 'clip' && e.clipId === clipId));
  }
}

// ---------- Playlists ----------

export function aktivePlaylist(p: Projekt): Playlist | undefined {
  return p.playlisten.find((x) => x.id === p.aktivePlaylistId) ?? p.playlisten[0];
}

/** Liefert die aktive Playlist; legt bei Bedarf «Playlist 1» an. */
export function sichereAktivePlaylist(p: Projekt, name = 'Playlist 1'): Playlist {
  let pl = aktivePlaylist(p);
  if (!pl) {
    pl = { id: neueId(), name, eintraege: [] };
    p.playlisten.push(pl);
  }
  p.aktivePlaylistId = pl.id;
  return pl;
}

export const neuerClipEintrag = (clipId: string): PlaylistEintrag => ({
  id: neueId(),
  typ: 'clip',
  clipId,
  uebergang: 'schnitt',
});

export const neueTitelfolie = (): PlaylistEintrag => ({
  id: neueId(),
  typ: 'titel',
  kicker: 'Analyse',
  titel: 'Titel',
  untertitel: '',
  dauer: 3,
  uebergang: 'schnitt',
});

export function verschiebeEintrag(pl: Playlist, von: number, nach: number): void {
  if (von === nach || von < 0 || von >= pl.eintraege.length) return;
  const [e] = pl.eintraege.splice(von, 1);
  if (!e) return;
  pl.eintraege.splice(Math.max(0, Math.min(nach, pl.eintraege.length)), 0, e);
}

export function setzeUebergang(pl: Playlist, eintragId: string, u: Uebergang): void {
  const e = pl.eintraege.find((x) => x.id === eintragId);
  if (e) e.uebergang = u;
}

export function dupliziereClipListe(
  p: Projekt,
  playlistId: string,
  suffix = ' (Kopie)',
): string | null {
  const pl = p.playlisten.find((x) => x.id === playlistId);
  if (!pl) return null;
  const kopie: Playlist = {
    id: neueId(),
    name: pl.name + suffix,
    eintraege: pl.eintraege.map((e) => ({ ...e, id: neueId() })),
  };
  p.playlisten.push(kopie);
  return kopie.id;
}

// ---------- Standbild und Zeitlupe im Clip ----------

export const STANDARD_STANDBILD_DAUER = 3;
export const ZEITLUPE_TEMPI = [0.25, 0.5] as const;

/** Fügt ein Standbild bei Quellzeit `zeit` ein (auf Bildgrenze gerundet, im Clip). */
export function fuegeStandbildHinzu(clip: Clip, zeit: number, dauer: number, fps: number): boolean {
  const z = aufBild(Math.min(Math.max(zeit, clip.in), clip.out), fps);
  if (!(dauer > 0)) return false;
  clip.freezeFrames.push({ zeit: z, dauer: runde(Math.min(dauer, 60)) });
  clip.freezeFrames.sort((a, b) => a.zeit - b.zeit);
  return true;
}

/** Fügt eine Zeitlupe ab `von` über `laenge` Original-Sekunden ein; false bei Überlappung/zu kurz. */
export function fuegeZeitlupeHinzu(
  clip: Clip,
  von: number,
  laenge: number,
  tempo: number,
  fps: number,
): boolean {
  const a = aufBild(Math.max(von, clip.in), fps);
  const b = aufBild(Math.min(von + laenge, clip.out), fps);
  if (b - a < 2 / fps) return false;
  if (clip.zeitlupen.some((z) => a < z.bis - 1e-6 && b > z.von + 1e-6)) return false;
  clip.zeitlupen.push({ von: a, bis: b, tempo });
  clip.zeitlupen.sort((x, y) => x.von - y.von);
  return true;
}

/** Trimmen mit Zeitabgleich der Zeichnungen (alle Aufrufer aus der Oberfläche nutzen diese Variante). */
export function trimmeClipImProjekt(
  p: Projekt,
  clipId: string,
  seite: 'in' | 'out',
  zeit: number,
  quelle: Pick<Quelle, 'dauer' | 'fps'>,
): boolean {
  return mitZeichnungsAbgleich(p, clipId, (c) => trimmeClip(c, seite, zeit, quelle)) ?? false;
}
