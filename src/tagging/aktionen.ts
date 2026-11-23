import { useProjekt } from '../store/projektStore';
import { usePlayer } from '../store/player';
import { useTagging } from '../store/tagging';
import { entferneTag, findeSpieler, fuegeTagHinzu } from './tagLogik';
import { verarbeiteTaste } from './zuordnung';

export function aktiveQuelle() {
  const p = useProjekt.getState().projekt;
  return p?.quellen.find((q) => q.id === p.aktiveQuelleId) ?? p?.quellen[0];
}

/** Aktuelle Abspielposition: bevorzugt direkt vom Video-Element. */
export function aktuelleZeit(): number {
  const v = document.querySelector('video');
  return v ? v.currentTime : usePlayer.getState().zeit;
}

/** Setzt ein Tag an der Abspielposition und öffnet die Zuordnung. Wiedergabe läuft weiter. */
export function setzeTag(defId: string): string | null {
  const st = useProjekt.getState();
  const q = aktiveQuelle();
  const def = st.projekt?.tagDefinitionen.find((d) => d.id === defId);
  if (!q || !def) return null;
  const zeit = aktuelleZeit();
  let id = '';
  st.aendere(`Tag «${def.name}»`, (p) => {
    id = fuegeTagHinzu(p, def, q, zeit);
  });
  useTagging.getState().setzeZuordnung({ tagId: id, teamIndex: null, nummer: '' });
  useTagging.getState().waehleTag(id);
  return id;
}

export function loescheTag(tagId: string): void {
  useProjekt.getState().aendere('Tag löschen', (p) => entferneTag(p, tagId));
  if (useTagging.getState().ausgewaehltTagId === tagId) useTagging.getState().waehleTag(null);
}

/** Verarbeitet eine Taste im Zuordnungsfenster. Gibt true zurück, wenn sie verbraucht wurde. */
export function zuordnungTaste(taste: string): boolean {
  const tg = useTagging.getState();
  const z = tg.zuordnung;
  if (!z) return false;
  const a = verarbeiteTaste(z, taste);
  if (a.typ === 'ignoriert') return false;
  if (a.typ === 'abbrechen') {
    tg.setzeZuordnung(null);
    return true;
  }
  const st = useProjekt.getState();
  if (a.typ === 'weiter') {
    tg.setzeZuordnung(a.zuordnung);
    return true;
  }
  if (a.typ === 'team') {
    const team = st.projekt?.teams[a.teamIndex];
    if (team)
      st.aendere('Tag: Team', (p) => {
        const t = p.tags.find((x) => x.id === z.tagId);
        if (t) {
          t.teamId = team.id;
          delete t.spielerId;
        }
      });
    tg.setzeZuordnung(a.zuordnung);
    return true;
  }
  // übernehmen
  const p = st.projekt;
  const tag = p?.tags.find((t) => t.id === z.tagId);
  if (p && tag && z.nummer !== '') {
    const nummer = Number(z.nummer);
    const team =
      z.teamIndex !== null ? p.teams[z.teamIndex] : p.teams.find((t) => findeSpieler(t, nummer));
    const sp = findeSpieler(team, nummer);
    if (team && sp) {
      st.aendere('Tag: Spieler', (d) => {
        const t = d.tags.find((x) => x.id === z.tagId);
        if (t) {
          t.teamId = team.id;
          t.spielerId = sp.id;
        }
      });
    }
  }
  tg.setzeZuordnung(null);
  return true;
}

/** Team der laufenden Zuordnung direkt wählen (z. B. per Klick). */
export function waehleZuordnungsTeam(teamIndex: 0 | 1): void {
  const tg = useTagging.getState();
  const z = tg.zuordnung;
  const st = useProjekt.getState();
  const team = st.projekt?.teams[teamIndex];
  if (!z || !team) return;
  st.aendere('Tag: Team', (p) => {
    const t = p.tags.find((x) => x.id === z.tagId);
    if (t) {
      t.teamId = team.id;
      delete t.spielerId;
    }
  });
  tg.setzeZuordnung({ ...z, teamIndex });
}
