/** Zustand der Zuordnung nach dem Taggen (Team per 1/2, Spielernummer per Ziffern + Enter). */
export interface Zuordnung {
  tagId: string;
  teamIndex: 0 | 1 | null;
  nummer: string;
}

export type ZuordnungsAktion =
  | { typ: 'weiter'; zuordnung: Zuordnung }
  | { typ: 'team'; zuordnung: Zuordnung; teamIndex: 0 | 1 }
  | { typ: 'uebernehmen'; zuordnung: Zuordnung }
  | { typ: 'abbrechen' }
  | { typ: 'ignoriert' };

/** Reine Zustandsmaschine für Tasteneingaben während der Zuordnung. */
export function verarbeiteTaste(z: Zuordnung, taste: string): ZuordnungsAktion {
  if (taste === 'Escape') return { typ: 'abbrechen' };
  if (taste === 'Enter') return { typ: 'uebernehmen', zuordnung: z };
  if (taste === 'Tab') {
    const teamIndex: 0 | 1 = z.teamIndex === 0 ? 1 : 0;
    return { typ: 'team', zuordnung: { ...z, teamIndex }, teamIndex };
  }
  if (taste === 'Backspace')
    return { typ: 'weiter', zuordnung: { ...z, nummer: z.nummer.slice(0, -1) } };
  if (/^\d$/.test(taste)) {
    if (z.teamIndex === null && z.nummer === '' && (taste === '1' || taste === '2')) {
      const teamIndex = taste === '1' ? 0 : 1;
      return { typ: 'team', zuordnung: { ...z, teamIndex }, teamIndex };
    }
    if (z.nummer.length >= 3) return { typ: 'ignoriert' };
    return { typ: 'weiter', zuordnung: { ...z, nummer: z.nummer + taste } };
  }
  return { typ: 'ignoriert' };
}
