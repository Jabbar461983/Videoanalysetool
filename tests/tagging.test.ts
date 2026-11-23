import { SCHEMA_VERSION } from '../src/model/typen';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseKaderCsv } from '../src/tagging/csv';
import { istGueltigesKuerzel, normalisiereKuerzel, pruefeHotkey } from '../src/tagging/kuerzel';
import { verarbeiteTaste, type Zuordnung } from '../src/tagging/zuordnung';
import {
  entferneTag,
  filtereTags,
  fuegeTagHinzu,
  uebernehmeInPlaylist,
} from '../src/tagging/tagLogik';
import { STANDARD_TAGS, RESERVIERTE_TASTEN } from '../src/tagging/standardTags';
import { migriere, neuesProjekt } from '../src/model/schema';
import type { Projekt, Quelle } from '../src/model/typen';
import { db } from '../src/db/db';
import { markiereStandard, neuesProjektMitVorlagen, speichereVorlage } from '../src/db/vorlagen';

const quelle: Quelle = {
  id: 'q1',
  dateiname: 'a.mp4',
  groesse: 1,
  teilHash: 'x',
  dauer: 100,
  fps: 25,
  breite: 1920,
  hoehe: 1080,
  codec: 'avc',
};
const mk = (): Projekt => {
  const p = neuesProjekt('T');
  p.quellen.push(quelle);
  return p;
};

describe('Standard-Tags', () => {
  it('enthält die 12 festen Tags, nur «Tor» zählt als Tor, Hotkeys eindeutig und unreserviert', () => {
    expect(STANDARD_TAGS).toHaveLength(12);
    expect(STANDARD_TAGS.filter((d) => d.istTor).map((d) => d.name)).toEqual(['Tor']);
    const keys = STANDARD_TAGS.map((d) => d.hotkey!);
    expect(new Set(keys).size).toBe(12);
    expect(keys.some((k) => RESERVIERTE_TASTEN.includes(k))).toBe(false);
    expect(STANDARD_TAGS.every((d) => d.vorlauf === 8 && d.nachlauf === 4)).toBe(true);
  });
});

describe('Kürzel & Hotkey', () => {
  it('normalisiert und validiert', () => {
    expect(normalisiereKuerzel('bu1ll')).toBe('BUL');
    expect(istGueltigesKuerzel('BUL')).toBe(true);
    expect(istGueltigesKuerzel('BU')).toBe(false);
    expect(istGueltigesKuerzel('bul')).toBe(false);
  });
  it('prüft Hotkeys', () => {
    const andere = [{ id: 'a', hotkey: 'G' }];
    expect(pruefeHotkey('g', 'b', andere, RESERVIERTE_TASTEN)).toBe('doppelt');
    expect(pruefeHotkey('g', 'a', andere, RESERVIERTE_TASTEN)).toBe('ok');
    expect(pruefeHotkey('S', 'b', andere, RESERVIERTE_TASTEN)).toBe('reserviert');
    expect(pruefeHotkey('GG', 'b', andere, RESERVIERTE_TASTEN)).toBe('ungueltig');
    expect(pruefeHotkey(undefined, 'b', andere, RESERVIERTE_TASTEN)).toBe('ok');
  });
});

describe('Kader-CSV', () => {
  it('liest Semikolon mit Kopfzeile', () => {
    const r = parseKaderCsv(
      'Nummer;Name;Position\n7;Max Muster;Stürmer\n12;Tim Tor;Torhüter\n3;Ben Back;Verteidiger',
    );
    expect(r.fehler).toEqual([]);
    expect(r.spieler.map((s) => [s.nummer, s.name, s.position])).toEqual([
      [7, 'Max Muster', 'stuermer'],
      [12, 'Tim Tor', 'torhueter'],
      [3, 'Ben Back', 'verteidiger'],
    ]);
  });
  it('liest Komma, BOM, Anführungszeichen, CRLF, ohne Kopfzeile', () => {
    const r = parseKaderCsv('﻿9,"Muster, Max",V\r\n10,"Anna ""Ace"" A",S\r\n');
    expect(r.spieler.map((s) => [s.nummer, s.name, s.position])).toEqual([
      [9, 'Muster, Max', 'verteidiger'],
      [10, 'Anna "Ace" A', 'stuermer'],
    ]);
  });
  it('meldet Fehler und überspringt die Zeilen', () => {
    const r = parseKaderCsv('1;A;Stürmer\n1;B;Stürmer\nx;C;Stürmer\n5;;Stürmer\n6;D;Pilot');
    expect(r.spieler).toHaveLength(1);
    expect(r.fehler.map((f) => f.zeile)).toEqual([2, 3, 4, 5]);
  });
});

describe('Zuordnung per Tastatur', () => {
  const z0: Zuordnung = { tagId: 't', teamIndex: null, nummer: '' };
  it('1/2 wählt zuerst das Team, danach sind Ziffern Nummern', () => {
    const a = verarbeiteTaste(z0, '2');
    expect(a).toMatchObject({ typ: 'team', teamIndex: 1 });
    const z1 = (a as { zuordnung: Zuordnung }).zuordnung;
    const b = verarbeiteTaste(z1, '1');
    expect(b).toMatchObject({ typ: 'weiter', zuordnung: { nummer: '1', teamIndex: 1 } });
  });
  it('Nummer, Backspace, Enter, Tab, Escape', () => {
    let z: Zuordnung = { ...z0, teamIndex: 0 };
    for (const k of ['1', '7']) z = (verarbeiteTaste(z, k) as { zuordnung: Zuordnung }).zuordnung;
    expect(z.nummer).toBe('17');
    z = (verarbeiteTaste(z, 'Backspace') as { zuordnung: Zuordnung }).zuordnung;
    expect(z.nummer).toBe('1');
    expect(verarbeiteTaste(z, 'Enter').typ).toBe('uebernehmen');
    expect(verarbeiteTaste(z, 'Tab')).toMatchObject({ typ: 'team', teamIndex: 1 });
    expect(verarbeiteTaste(z, 'Escape').typ).toBe('abbrechen');
    expect(verarbeiteTaste(z, 'x').typ).toBe('ignoriert');
  });
  it('begrenzt die Nummer auf 3 Stellen', () => {
    expect(verarbeiteTaste({ ...z0, teamIndex: 0, nummer: '123' }, '4').typ).toBe('ignoriert');
  });
});

describe('Tags und Auto-Clips', () => {
  let p: Projekt;
  beforeEach(() => {
    p = mk();
  });
  it('erzeugt Clip mit Vor-/Nachlauf, begrenzt auf die Quelle', () => {
    const tor = p.tagDefinitionen.find((d) => d.istTor)!;
    const id = fuegeTagHinzu(p, tor, quelle, 50);
    const c = p.clips.find((x) => x.tagId === id)!;
    expect([c.in, c.out]).toEqual([42, 54]);
    const id2 = fuegeTagHinzu(p, tor, quelle, 2);
    expect(p.clips.find((x) => x.tagId === id2)!.in).toBe(0);
    const id3 = fuegeTagHinzu(p, tor, quelle, 99);
    expect(p.clips.find((x) => x.tagId === id3)!.out).toBe(100);
  });
  it('löscht Tag samt Clip und Playlist-Eintrag', () => {
    const def = p.tagDefinitionen[0]!;
    const id = fuegeTagHinzu(p, def, quelle, 10);
    uebernehmeInPlaylist(p, { defIds: [] });
    expect(p.playlisten[0]!.eintraege).toHaveLength(1);
    entferneTag(p, id);
    expect([p.tags.length, p.clips.length, p.playlisten[0]!.eintraege.length]).toEqual([0, 0, 0]);
  });
});

describe('Filter und Playlist', () => {
  it('Kombination und Übernahme ohne Dubletten, chronologisch', () => {
    const p = mk();
    const [a, b] = [p.tagDefinitionen[0]!, p.tagDefinitionen[1]!];
    const t1 = fuegeTagHinzu(p, a, quelle, 30);
    const t2 = fuegeTagHinzu(p, b, quelle, 10);
    const t3 = fuegeTagHinzu(p, a, quelle, 20);
    const sp = { id: 's1', nummer: 7, name: 'X', position: 'stuermer' as const };
    p.teams[0].kader.push(sp);
    for (const id of [t1, t3]) {
      const t = p.tags.find((x) => x.id === id)!;
      t.teamId = p.teams[0].id;
    }
    p.tags.find((x) => x.id === t3)!.spielerId = 's1';

    expect(filtereTags(p.tags, { defIds: [a.id] })).toHaveLength(2);
    expect(filtereTags(p.tags, { defIds: [], teamId: p.teams[0].id })).toHaveLength(2);
    expect(filtereTags(p.tags, { defIds: [a.id], spielerId: 's1' }).map((t) => t.id)).toEqual([t3]);
    expect(filtereTags(p.tags, { defIds: [b.id], teamId: p.teams[0].id })).toEqual([]);
    expect(filtereTags(p.tags, { defIds: [] })).toHaveLength(3);

    expect(uebernehmeInPlaylist(p, { defIds: [] })).toBe(3);
    const reihenfolge = p.playlisten[0]!.eintraege.map((e) =>
      e.typ === 'clip'
        ? p.tags.find((t) => t.id === p.clips.find((c) => c.id === e.clipId)!.tagId)!.zeit
        : -1,
    );
    expect(reihenfolge).toEqual([10, 20, 30]);
    expect(uebernehmeInPlaylist(p, { defIds: [] })).toBe(0);
    void t2;
  });
});

describe('Migration auf Version 2', () => {
  it('ergänzt Standard-Tags und Felder', () => {
    const alt = { ...neuesProjekt('alt'), version: 1, tagDefinitionen: [] as unknown[] };
    expect(migriere(alt).tagDefinitionen).toHaveLength(12);
    const mitEigenem = {
      ...alt,
      tagDefinitionen: [
        { id: 'x', name: 'Eigen', farbe: '#fff', vorlauf: 5, nachlauf: 5, istTor: false },
      ],
    };
    const m = migriere(mitEigenem);
    expect(m.version).toBe(SCHEMA_VERSION);
    expect(m.tagDefinitionen[0]).toMatchObject({ sichtbar: true, fest: false });
  });
});

describe('Vorlagen', () => {
  beforeEach(async () => {
    await db.vorlagen.clear();
  });
  it('wendet Standard-Vorlagen auf neue Projekte an; nur eine Standard-Vorlage je Typ', async () => {
    const v1 = await speichereVorlage(
      'team',
      'BUL – SHC Bulldozers',
      { kuerzel: 'BUL', name: 'SHC Bulldozers', farbe: '#007057' },
      true,
    );
    const v2 = await speichereVorlage(
      'team',
      'Andere',
      { kuerzel: 'AND', name: 'Andere', farbe: '#000000' },
      true,
    );
    expect((await db.vorlagen.get(v1.id))!.standard).toBe(false);
    await markiereStandard('team', v1.id);
    await speichereVorlage('kader', 'K', [{ nummer: 9, name: 'Nine', position: 'stuermer' }], true);
    const p = await neuesProjektMitVorlagen('Neu');
    expect(p.teams[0]).toMatchObject({ kuerzel: 'BUL', name: 'SHC Bulldozers' });
    expect(p.teams[0].kader.map((s) => s.nummer)).toEqual([9]);
    expect(p.teams[0].kader[0]!.id).toBeTruthy();
    expect(p.teams[1].kuerzel).toBe('GEG');
    void v2;
  });
});
