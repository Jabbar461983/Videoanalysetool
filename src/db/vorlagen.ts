import { db, type VorlageRow, type VorlageTyp } from './db';
import { neueId, neuesProjekt } from '../model/schema';
import type { Projekt, Spieler, TagDef, Team } from '../model/typen';

export interface TeamVorlage {
  kuerzel: string;
  name: string;
  farbe: string;
}
export type KaderVorlage = Omit<Spieler, 'id'>[];
export type TagSetVorlage = TagDef[];

export const listeVorlagen = (typ: VorlageTyp): Promise<VorlageRow[]> =>
  db.vorlagen.where('typ').equals(typ).toArray();

export async function speichereVorlage(
  typ: VorlageTyp,
  name: string,
  daten: unknown,
  standard = false,
): Promise<VorlageRow> {
  const row: VorlageRow = { id: neueId(), typ, name, daten, standard };
  await db.transaction('rw', db.vorlagen, async () => {
    if (standard) await markiereStandard(typ, null);
    await db.vorlagen.put(row);
  });
  return row;
}
export const loescheVorlage = (id: string) => db.vorlagen.delete(id);

/** Genau eine Vorlage je Typ kann «Standard für neue Projekte» sein (id = null: keine). */
export async function markiereStandard(typ: VorlageTyp, id: string | null): Promise<void> {
  await db.transaction('rw', db.vorlagen, async () => {
    for (const v of await db.vorlagen.where('typ').equals(typ).toArray()) {
      if (v.standard !== (v.id === id)) await db.vorlagen.update(v.id, { standard: v.id === id });
    }
  });
}

export function teamAusVorlage(team: Team, v: TeamVorlage): void {
  team.kuerzel = v.kuerzel;
  team.name = v.name;
  team.farbe = v.farbe;
}
export function kaderAusVorlage(v: KaderVorlage): Spieler[] {
  return v.map((s) => ({ ...s, id: neueId() }));
}

/** Neues Projekt mit den als Standard markierten Vorlagen (Team 1, Kader von Team 1, Tag-Set). */
export async function neuesProjektMitVorlagen(name: string): Promise<Projekt> {
  const p = neuesProjekt(name);
  const std = async (typ: VorlageTyp) => (await listeVorlagen(typ)).find((v) => v.standard);
  const [t, k, ts] = await Promise.all([std('team'), std('kader'), std('tagset')]);
  if (t) teamAusVorlage(p.teams[0], t.daten as TeamVorlage);
  if (k) p.teams[0].kader = kaderAusVorlage(k.daten as KaderVorlage);
  if (ts) p.tagDefinitionen = (ts.daten as TagSetVorlage).map((d) => ({ ...d }));
  return p;
}
