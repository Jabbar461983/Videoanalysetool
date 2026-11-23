import type { Clip, Projekt, Quelle, Spieler, Tag, TagDef, Team } from '../model/typen';
import { neueId } from '../model/schema';
import { formatZeit } from '../video/bildmathe';

const runde = (x: number) => Math.round(x * 1000) / 1000;

export function clipFuerTag(tag: Tag, def: TagDef, quelle: Pick<Quelle, 'dauer' | 'fps'>): Clip {
  return {
    id: neueId(),
    quelleId: tag.quelleId,
    in: runde(Math.max(0, tag.zeit - def.vorlauf)),
    out: runde(Math.min(quelle.dauer, tag.zeit + def.nachlauf)),
    name: `${def.name} ${formatZeit(tag.zeit, quelle.fps)}`,
    freezeFrames: [],
    tagId: tag.id,
  };
}

/** Setzt Tag und Auto-Clip in den (Entwurf-)Zustand. Gibt die Tag-Id zurück. */
export function fuegeTagHinzu(p: Projekt, def: TagDef, quelle: Quelle, zeit: number): string {
  const tag: Tag = {
    id: neueId(),
    defId: def.id,
    quelleId: quelle.id,
    zeit: runde(Math.min(Math.max(0, zeit), quelle.dauer)),
  };
  p.tags.push(tag);
  p.clips.push(clipFuerTag(tag, def, quelle));
  return tag.id;
}

/** Löscht Tag samt Auto-Clip (und entfernt diesen aus der Playlist). */
export function entferneTag(p: Projekt, tagId: string): void {
  const clip = p.clips.find((c) => c.tagId === tagId);
  p.tags = p.tags.filter((t) => t.id !== tagId);
  if (clip) {
    p.clips = p.clips.filter((c) => c.id !== clip.id);
    p.playlist = p.playlist.filter((e) => !(e.typ === 'clip' && e.clipId === clip.id));
  }
}

export function findeSpieler(team: Team | undefined, nummer: number): Spieler | undefined {
  return team?.kader.find((s) => s.nummer === nummer);
}

export interface TagFilter {
  defIds: string[];
  teamId?: string;
  spielerId?: string;
}
export const leererFilter = (): TagFilter => ({ defIds: [] });
export const filterAktiv = (f: TagFilter): boolean =>
  f.defIds.length > 0 || !!f.teamId || !!f.spielerId;

/** Kombination: alle gesetzten Kriterien müssen zutreffen (Tags innerhalb der Auswahl: ODER). */
export function filtereTags(tags: Tag[], f: TagFilter): Tag[] {
  return tags.filter(
    (t) =>
      (f.defIds.length === 0 || f.defIds.includes(t.defId)) &&
      (!f.teamId || t.teamId === f.teamId) &&
      (!f.spielerId || t.spielerId === f.spielerId),
  );
}

export const sortiereTags = (tags: Tag[], quellenReihenfolge: string[]): Tag[] =>
  [...tags].sort(
    (a, b) =>
      quellenReihenfolge.indexOf(a.quelleId) - quellenReihenfolge.indexOf(b.quelleId) ||
      a.zeit - b.zeit,
  );

/** Hängt die Auto-Clips der gefilterten Tags (chronologisch) an die Playlist; ohne Dubletten. Gibt die Anzahl neuer Einträge zurück. */
export function uebernehmeInPlaylist(p: Projekt, f: TagFilter): number {
  const reihenfolge = p.quellen.map((q) => q.id);
  let n = 0;
  for (const tag of sortiereTags(filtereTags(p.tags, f), reihenfolge)) {
    const clip = p.clips.find((c) => c.tagId === tag.id);
    if (!clip || p.playlist.some((e) => e.typ === 'clip' && e.clipId === clip.id)) continue;
    p.playlist.push({ typ: 'clip', clipId: clip.id });
    n++;
  }
  return n;
}
