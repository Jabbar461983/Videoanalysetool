import type { Projekt } from '../model/typen';

export type Stand = [number, number];

interface Ereignis {
  quelle: number;
  zeit: number;
  /** 0 = Tor Team 1, 1 = Tor Team 2, 2 = Korrektur */
  art: 0 | 1 | 2;
  stand?: Stand;
}

/** Tore ohne Teamzuordnung (zählen nicht) – als Hinweis für die Oberfläche. */
export function toreOhneTeam(p: Projekt): number {
  const tor = new Set(p.tagDefinitionen.filter((d) => d.istTor).map((d) => d.id));
  return p.tags.filter((t) => tor.has(t.defId) && !p.teams.some((tm) => tm.id === t.teamId)).length;
}

/**
 * Spielstand zur Quellzeit `t` in Quelle `quelleId`:
 * Startstand + Tor-Tags (mit Team) bis einschliesslich `t`; Quellen zählen in Projektreihenfolge
 * (Tore der 1. Halbzeit zählen in der 2. voll). Eine Korrektur setzt den Stand ab ihrem Zeitpunkt
 * fest, spätere Tore zählen darauf weiter; bei gleichem Zeitpunkt gewinnt die Korrektur.
 */
export function spielstand(p: Projekt, quelleId: string, t: number): Stand {
  const qi = p.quellen.findIndex((q) => q.id === quelleId);
  let stand: Stand = [...p.einstellungen.startstand];
  if (qi < 0) return stand;
  const idx = (id: string) => p.quellen.findIndex((q) => q.id === id);
  const tor = new Set(p.tagDefinitionen.filter((d) => d.istTor).map((d) => d.id));
  const ereignisse: Ereignis[] = [];
  for (const tag of p.tags) {
    if (!tor.has(tag.defId)) continue;
    const team = p.teams.findIndex((tm) => tm.id === tag.teamId);
    const q = idx(tag.quelleId);
    if (team < 0 || q < 0) continue;
    ereignisse.push({ quelle: q, zeit: tag.zeit, art: team as 0 | 1 });
  }
  for (const k of p.overlays.scoreKorrekturen) {
    const q = idx(k.quelleId);
    if (q >= 0) ereignisse.push({ quelle: q, zeit: k.zeit, art: 2, stand: k.stand });
  }
  ereignisse.sort((a, b) => a.quelle - b.quelle || a.zeit - b.zeit || a.art - b.art);
  for (const e of ereignisse) {
    if (e.quelle > qi || (e.quelle === qi && e.zeit > t + 1e-9)) break;
    if (e.art === 2 && e.stand) stand = [...e.stand];
    else if (e.art === 0) stand = [stand[0] + 1, stand[1]];
    else stand = [stand[0], stand[1] + 1];
  }
  return stand;
}
