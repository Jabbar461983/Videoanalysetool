import { describe, expect, it } from 'vitest';
import {
  blendeAlpha,
  clipDauer,
  clipSegmente,
  clipZeitZuQuellZeit,
  eintragBei,
  playlistZeitplan,
  quellZeitZuClipZeit,
  segmentZuQuellZeit,
} from '../src/wiedergabe/zeitachse';
import type { Clip, PlaylistEintrag } from '../src/model/typen';

const clip = (o: Partial<Clip> = {}): Clip => ({
  id: 'c1',
  quelleId: 'q',
  in: 10,
  out: 20,
  name: 'c',
  freezeFrames: [],
  zeitlupen: [],
  ...o,
});

describe('clipZeitZuQuellZeit', () => {
  it('einfacher Clip: lineare Abbildung', () => {
    const c = clip();
    expect(clipDauer(c)).toBe(10);
    expect(clipZeitZuQuellZeit(c, 0).quellZeit).toBe(10);
    expect(clipZeitZuQuellZeit(c, 4.5).quellZeit).toBe(14.5);
    expect(clipZeitZuQuellZeit(c, 10).quellZeit).toBe(20);
    expect(clipZeitZuQuellZeit(c, 99).quellZeit).toBe(20);
  });
  it('Freeze-Frame verlängert den Clip und hält das Bild', () => {
    const c = clip({ freezeFrames: [{ zeit: 14, dauer: 3 }] });
    expect(clipDauer(c)).toBe(13);
    expect(clipZeitZuQuellZeit(c, 3.9).quellZeit).toBeCloseTo(13.9);
    const f = clipZeitZuQuellZeit(c, 4.5);
    expect(f).toMatchObject({ quellZeit: 14, freeze: true });
    expect(clipZeitZuQuellZeit(c, 7).quellZeit).toBe(14); // Ende des Freeze → weiter
    expect(clipZeitZuQuellZeit(c, 8).quellZeit).toBe(15);
    expect(clipZeitZuQuellZeit(c, 13).quellZeit).toBe(20);
  });
  it('Freeze am Clipanfang und -ende', () => {
    const c = clip({
      freezeFrames: [
        { zeit: 10, dauer: 2 },
        { zeit: 20, dauer: 1 },
      ],
    });
    expect(clipDauer(c)).toBe(13);
    expect(clipSegmente(c).map((s) => s.art)).toEqual(['freeze', 'video', 'freeze']);
    expect(clipZeitZuQuellZeit(c, 1).freeze).toBe(true);
    expect(clipZeitZuQuellZeit(c, 12.5)).toMatchObject({ quellZeit: 20, freeze: true });
  });
  it('Zeitlupe dehnt die Dauer: 0.5× verdoppelt', () => {
    const c = clip({ zeitlupen: [{ von: 12, bis: 14, tempo: 0.5 }] });
    expect(clipDauer(c)).toBe(12); // 2 + 4 + 6
    expect(clipZeitZuQuellZeit(c, 2).quellZeit).toBe(12);
    expect(clipZeitZuQuellZeit(c, 4).quellZeit).toBe(13); // 2 s Clipzeit in der Zeitlupe = 1 s Quelle
    expect(clipZeitZuQuellZeit(c, 6).quellZeit).toBe(14);
    expect(clipZeitZuQuellZeit(c, 7).quellZeit).toBe(15);
    expect(clipSegmente(c).map((s) => s.tempo)).toEqual([1, 0.5, 1]);
  });
  it('Zeitlupe und Freeze kombiniert, Dauer ist Summe der Segmente', () => {
    const c = clip({
      freezeFrames: [{ zeit: 13, dauer: 3 }],
      zeitlupen: [{ von: 12, bis: 14, tempo: 0.25 }],
    });
    const segs = clipSegmente(c);
    expect(segs.map((s) => s.art)).toEqual(['video', 'video', 'freeze', 'video', 'video']);
    expect(clipDauer(c)).toBeCloseTo(2 + 4 + 3 + 4 + 6);
    for (let i = 1; i < segs.length; i++)
      expect(segs[i]!.start).toBeCloseTo(segs[i - 1]!.start + segs[i - 1]!.dauer);
  });
  it('Freeze/Zeitlupe ausserhalb des Clips werden ignoriert bzw. geklammert', () => {
    const c = clip({
      freezeFrames: [{ zeit: 5, dauer: 3 }],
      zeitlupen: [{ von: 18, bis: 25, tempo: 0.5 }],
    });
    expect(clipDauer(c)).toBeCloseTo(8 + 4); // 2 s normal bis 18 + (18..20 mit 0.5 → 4 s)
  });
  it('Umkehrung Quellzeit → Clipzeit', () => {
    const c = clip({ freezeFrames: [{ zeit: 14, dauer: 3 }] });
    expect(quellZeitZuClipZeit(c, 12)).toBe(2);
    expect(quellZeitZuClipZeit(c, 16)).toBe(9);
  });
});

describe('Playlist-Zeitplan', () => {
  const clips = [
    clip({ id: 'a', in: 0, out: 4 }),
    clip({ id: 'b', in: 50, out: 56, freezeFrames: [{ zeit: 52, dauer: 2 }] }),
  ];
  const eintraege: PlaylistEintrag[] = [
    {
      id: 'e1',
      typ: 'titel',
      kicker: 'K',
      titel: 'T',
      untertitel: '',
      dauer: 3,
      uebergang: 'schnitt',
    },
    { id: 'e2', typ: 'clip', clipId: 'a', uebergang: 'schnitt' },
    { id: 'e3', typ: 'clip', clipId: 'b', uebergang: 'blende' },
    { id: 'e4', typ: 'clip', clipId: 'fehlt', uebergang: 'schnitt' },
  ];
  const plan = playlistZeitplan({ eintraege }, clips);
  it('summiert Dauern und überspringt fehlende Clips', () => {
    expect(plan.eintraege.map((e) => [e.index, e.start, e.dauer])).toEqual([
      [0, 0, 3],
      [1, 3, 4],
      [2, 7, 8],
    ]);
    expect(plan.dauer).toBe(15);
  });
  it('findet Position und Quellzeit über Clipgrenzen', () => {
    expect(eintragBei(plan, 1)!.index).toBe(0);
    expect(eintragBei(plan, 3)!.index).toBe(1);
    expect(segmentZuQuellZeit(plan.segmente, 1)).toBeNull(); // Titel
    expect(segmentZuQuellZeit(plan.segmente, 4)!.quellZeit).toBe(1);
    expect(segmentZuQuellZeit(plan.segmente, 7 + 2.5)).toMatchObject({
      quellZeit: 52,
      freeze: true,
    });
    expect(segmentZuQuellZeit(plan.segmente, 14.9)!.quellZeit).toBeCloseTo(56, 0);
  });
  it('Blende: schwarz an der Grenze, 0 in der Mitte, nur wo eingestellt', () => {
    expect(blendeAlpha(plan, 3)).toBe(0); // e2 hat «schnitt»
    expect(blendeAlpha(plan, 7)).toBe(1); // genau an der Blende zu e3
    expect(blendeAlpha(plan, 7 - 0.075)).toBeCloseTo(0.5);
    expect(blendeAlpha(plan, 7 + 0.075)).toBeCloseTo(0.5);
    expect(blendeAlpha(plan, 7.2)).toBe(0);
    expect(blendeAlpha(plan, 5)).toBe(0);
  });
  it('Titel hat Mindestdauer 0.5 s', () => {
    const p = playlistZeitplan(
      { eintraege: [{ ...(eintraege[0] as PlaylistEintrag & { typ: 'titel' }), dauer: 0 }] },
      [],
    );
    expect(p.dauer).toBe(0.5);
  });
});
