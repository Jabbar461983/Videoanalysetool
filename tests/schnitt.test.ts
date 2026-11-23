import { describe, expect, it } from 'vitest';
import { migriere, neuesProjekt } from '../src/model/schema';
import {
  aktivePlaylist,
  aufBild,
  dupliziereClip,
  dupliziereClipListe,
  entferneClip,
  fuegeStandbildHinzu,
  fuegeZeitlupeHinzu,
  neuerClip,
  neuerClipEintrag,
  neueTitelfolie,
  sichereAktivePlaylist,
  trimmeClip,
  verschiebeEintrag,
} from '../src/schnitt/schnittLogik';
import { clipDauer } from '../src/wiedergabe/zeitachse';
import type { Projekt } from '../src/model/typen';

const q = { id: 'q', dauer: 100, fps: 25 };

describe('Clips schneiden', () => {
  it('legt Clips auf Bildgrenzen an, vertauscht In/Out, begrenzt, lehnt zu kurze ab', () => {
    const c = neuerClip(q, 20.013, 10.019)!;
    expect([c.in, c.out]).toEqual([10.0, 20.0]);
    expect(aufBild(10.019, 25)).toBe(10.0);
    expect(neuerClip(q, 10, 10.3)).toBeNull();
    expect(neuerClip(q, -5, 3)!.in).toBe(0);
    expect(neuerClip(q, 98, 120)!.out).toBe(100);
  });
  it('trimmt bildgenau und hält Mindestlänge', () => {
    const c = neuerClip(q, 10, 20)!;
    expect(trimmeClip(c, 'in', 12.04, q)).toBe(true);
    expect(c.in).toBe(12.04);
    expect(trimmeClip(c, 'out', 12.2, q)).toBe(false);
    expect(trimmeClip(c, 'out', 150, q)).toBe(false);
    expect(trimmeClip(c, 'out', 15, q)).toBe(true);
  });
  it('Trimmen entfernt Standbilder ausserhalb und kürzt Zeitlupen', () => {
    const c = neuerClip(q, 10, 20)!;
    fuegeStandbildHinzu(c, 11, 3, 25);
    fuegeStandbildHinzu(c, 18, 3, 25);
    fuegeZeitlupeHinzu(c, 13, 4, 0.5, 25);
    trimmeClip(c, 'in', 12, q);
    trimmeClip(c, 'out', 15, q);
    expect(c.freezeFrames).toEqual([]);
    expect(c.zeitlupen).toEqual([{ von: 13, bis: 15, tempo: 0.5 }]);
  });
  it('Standbild und Zeitlupe: Dauer, Rundung, Überlappung', () => {
    const c = neuerClip(q, 10, 20)!;
    expect(fuegeStandbildHinzu(c, 14.013, 3, 25)).toBe(true);
    expect(c.freezeFrames[0]).toEqual({ zeit: 14.0, dauer: 3 });
    expect(fuegeStandbildHinzu(c, 14, 0, 25)).toBe(false);
    expect(fuegeZeitlupeHinzu(c, 12, 2, 0.5, 25)).toBe(true);
    expect(fuegeZeitlupeHinzu(c, 13, 2, 0.25, 25)).toBe(false); // überlappt
    expect(fuegeZeitlupeHinzu(c, 14, 2, 0.25, 25)).toBe(true);
    expect(fuegeZeitlupeHinzu(c, 19.95, 5, 0.5, 25)).toBe(false); // zu kurz (am Ende abgeschnitten)
    expect(clipDauer(c)).toBeCloseTo(10 - 4 + 4 + 8 + 3);
  });
});

describe('Bibliothek und Playlists', () => {
  const mk = (): Projekt => {
    const p = neuesProjekt('x');
    p.quellen.push({
      id: 'q',
      dateiname: 'a',
      groesse: 1,
      teilHash: 'h',
      dauer: 100,
      fps: 25,
      breite: 1,
      hoehe: 1,
      codec: 'avc',
    });
    return p;
  };
  it('dupliziert Clips unabhängig vom Tag', () => {
    const p = mk();
    const c = neuerClip(q, 1, 5)!;
    c.tagId = 't1';
    c.freezeFrames.push({ zeit: 2, dauer: 1 });
    p.clips.push(c);
    const id = dupliziereClip(p, c.id)!;
    const k = p.clips.find((x) => x.id === id)!;
    expect(k.tagId).toBeUndefined();
    expect(k.freezeFrames).toEqual(c.freezeFrames);
    k.freezeFrames[0]!.dauer = 9;
    expect(c.freezeFrames[0]!.dauer).toBe(1);
    expect(p.clips.map((x) => x.id)).toEqual([c.id, id]);
  });
  it('Clip löschen entfernt Playlist-Einträge in allen Playlists', () => {
    const p = mk();
    const c = neuerClip(q, 1, 5)!;
    p.clips.push(c);
    const a = sichereAktivePlaylist(p);
    a.eintraege.push(neuerClipEintrag(c.id), neueTitelfolie());
    const kopie = dupliziereClipListe(p, a.id)!;
    expect(p.playlisten.find((x) => x.id === kopie)!.eintraege[0]!.id).not.toBe(a.eintraege[0]!.id);
    entferneClip(p, c.id);
    expect(p.playlisten.map((x) => x.eintraege.length)).toEqual([1, 1]);
  });
  it('mehrere Playlists, aktive wählbar; Reihenfolge per Verschieben', () => {
    const p = mk();
    const a = sichereAktivePlaylist(p);
    expect(sichereAktivePlaylist(p).id).toBe(a.id);
    a.eintraege.push(neuerClipEintrag('1'), neuerClipEintrag('2'), neuerClipEintrag('3'));
    verschiebeEintrag(a, 0, 2);
    expect(a.eintraege.map((e) => (e.typ === 'clip' ? e.clipId : ''))).toEqual(['2', '3', '1']);
    verschiebeEintrag(a, 2, 0);
    expect(a.eintraege.map((e) => (e.typ === 'clip' ? e.clipId : ''))).toEqual(['1', '2', '3']);
    verschiebeEintrag(a, 5, 0); // ungültig → keine Änderung
    expect(a.eintraege).toHaveLength(3);
    p.aktivePlaylistId = 'gibt-es-nicht';
    expect(aktivePlaylist(p)!.id).toBe(a.id);
  });
});

describe('Migration auf Version 3', () => {
  it('übernimmt die alte Playlist und ergänzt Zeitlupen', () => {
    const p = neuesProjekt('alt') as unknown as Record<string, unknown>;
    delete p.playlisten;
    p.version = 2;
    p.clips = [{ id: 'c', quelleId: 'q', in: 0, out: 5, name: 'c', freezeFrames: [] }];
    p.playlist = [
      { typ: 'clip', clipId: 'c' },
      { typ: 'titel', text: 'Hallo', dauer: 4 },
    ];
    const m = migriere(p);
    expect(m.version).toBe(6);
    expect(m.clips[0]!.zeitlupen).toEqual([]);
    expect(m.playlisten).toHaveLength(1);
    expect(m.aktivePlaylistId).toBe(m.playlisten[0]!.id);
    const e = m.playlisten[0]!.eintraege;
    expect(e[0]).toMatchObject({ typ: 'clip', clipId: 'c', uebergang: 'schnitt' });
    expect(e[1]).toMatchObject({ typ: 'titel', titel: 'Hallo', dauer: 4 });
    expect('playlist' in m).toBe(false);
  });
  it('leere alte Playlist ergibt keine Playlist', () => {
    const p = neuesProjekt('alt') as unknown as Record<string, unknown>;
    p.version = 2;
    p.playlist = [];
    delete p.playlisten;
    expect(migriere(p).playlisten).toEqual([]);
  });
});
