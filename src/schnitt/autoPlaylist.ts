import { neueId } from '../model/schema';
import type { Clip, PlaylistEintrag, Projekt, Tag } from '../model/typen';
import { neuerClipEintrag } from './schnittLogik';

/** Auswahl für die automatische Playlist: Tag-Arten (ODER), Team, Spieler, Video – alles Gesetzte muss zutreffen. */
export interface AutoAuswahl {
  defIds: string[];
  teamId?: string;
  spielerId?: string;
  quelleId?: string;
  /** Tags, die der Nutzer in der Vorschau abgewählt hat */
  ausgeschlossen: string[];
}

export interface AutoOptionen {
  /** Nach Thema (Tag-Art) gruppieren und vor jeder Gruppe eine Titelfolie einfügen */
  gruppieren: boolean;
  /** Dauer der Titelfolien in Sekunden */
  titelDauer?: number;
}

export interface Treffer {
  tag: Tag;
  clip: Clip;
}

export const leereAuswahl = (): AutoAuswahl => ({ defIds: [], ausgeschlossen: [] });

/** Alle Szenen, die zur Auswahl passen (ohne die abgewählten), chronologisch nach Videoreihenfolge und Zeit. Nur Tags mit Clip. */
export function findeTreffer(p: Projekt, a: AutoAuswahl): Treffer[] {
  const reihenfolge = p.quellen.map((q) => q.id);
  return p.tags
    .filter(
      (t) =>
        (a.defIds.length === 0 || a.defIds.includes(t.defId)) &&
        (!a.teamId || t.teamId === a.teamId) &&
        (!a.spielerId || t.spielerId === a.spielerId) &&
        (!a.quelleId || t.quelleId === a.quelleId),
    )
    .sort(
      (x, y) =>
        reihenfolge.indexOf(x.quelleId) - reihenfolge.indexOf(y.quelleId) || x.zeit - y.zeit,
    )
    .flatMap((tag) => {
      const clip = p.clips.find((c) => c.tagId === tag.id);
      return clip ? [{ tag, clip }] : [];
    });
}

/** Kurzbeschreibung des Filters für den Kicker der Titelfolien, z. B. «#17 Meier». */
export function filterBeschriftung(p: Projekt, a: AutoAuswahl): string {
  if (a.spielerId) {
    for (const tm of p.teams) {
      const sp = tm.kader.find((s) => s.id === a.spielerId);
      if (sp) return `#${sp.nummer} ${sp.name}`.trim();
    }
  }
  const team = p.teams.find((tm) => tm.id === a.teamId);
  return team ? team.kuerzel : 'Analyse';
}

/** Name für eine neu angelegte Playlist, z. B. «Tore» oder «#17 Meier – Tore, Bully gewonnen». */
export function vorschlagName(p: Projekt, a: AutoAuswahl): string {
  const defs = a.defIds
    .map((id) => p.tagDefinitionen.find((d) => d.id === id)?.name)
    .filter((x): x is string => !!x);
  const was = defs.length === 0 ? 'Alle Szenen' : defs.join(', ');
  const wer = a.spielerId || a.teamId ? filterBeschriftung(p, a) : '';
  return wer ? `${wer} – ${was}` : was;
}

/**
 * Baut die Einträge, die angehängt werden sollen. Clips, die schon in `bestehend` stehen, werden übersprungen
 * (und Gruppen ohne neue Clips bekommen keine Titelfolie).
 */
export function baueAutoEintraege(
  p: Projekt,
  a: AutoAuswahl,
  o: AutoOptionen,
  bestehend: PlaylistEintrag[] = [],
): PlaylistEintrag[] {
  const schon = new Set(bestehend.flatMap((e) => (e.typ === 'clip' ? [e.clipId] : [])));
  const treffer = findeTreffer(p, a).filter(
    (x) => !a.ausgeschlossen.includes(x.tag.id) && !schon.has(x.clip.id),
  );
  if (!o.gruppieren) return treffer.map((x) => neuerClipEintrag(x.clip.id));
  const kicker = filterBeschriftung(p, a);
  const aus: PlaylistEintrag[] = [];
  // Reihenfolge der Themen wie in der Tag-Leiste, chronologisch innerhalb
  for (const def of p.tagDefinitionen) {
    const gruppe = treffer.filter((x) => x.tag.defId === def.id);
    if (gruppe.length === 0) continue;
    aus.push({
      id: neueId(),
      typ: 'titel',
      uebergang: 'schnitt',
      kicker,
      titel: def.name,
      untertitel: `${gruppe.length} ${gruppe.length === 1 ? 'Szene' : 'Szenen'}`,
      dauer: o.titelDauer ?? 2,
    });
    for (const x of gruppe) aus.push(neuerClipEintrag(x.clip.id));
  }
  return aus;
}

/**
 * Hängt die automatisch gebauten Einträge ans Ende einer Playlist an. `ziel` = Id einer vorhandenen Playlist
 * oder `{ name }` für eine neue. Gibt Playlist-Id und Anzahl neuer Szenen zurück.
 */
export function fuelleAutomatisch(
  p: Projekt,
  ziel: string | { name: string },
  a: AutoAuswahl,
  o: AutoOptionen,
): { playlistId: string; szenen: number } | null {
  let pl = typeof ziel === 'string' ? p.playlisten.find((x) => x.id === ziel) : undefined;
  if (typeof ziel !== 'string') {
    pl = { id: neueId(), name: ziel.name.trim() || 'Playlist', eintraege: [] };
    p.playlisten.push(pl);
  }
  if (!pl) return null;
  const neu = baueAutoEintraege(p, a, o, pl.eintraege);
  pl.eintraege.push(...neu);
  p.aktivePlaylistId = pl.id;
  return { playlistId: pl.id, szenen: neu.filter((e) => e.typ === 'clip').length };
}
