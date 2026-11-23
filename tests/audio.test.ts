import { describe, expect, it } from 'vitest';
import { migriere, neuesProjekt } from '../src/model/schema';
import {
  aendereSegmentZeit,
  benutzteBlobIds,
  holeAudio,
  neueSpur,
  segment,
  spurFuer,
  standardAudio,
} from '../src/audio/modell';
import { audioPlan, DUCK_AB, DUCK_AUF, gainBei } from '../src/audio/plan';
import { clipPlan, playlistZeitplan } from '../src/wiedergabe/zeitachse';
import { mitZeichnungsAbgleich } from '../src/zeichnen/logik';
import type { Clip, Projekt } from '../src/model/typen';

const clip = (o: Partial<Clip> = {}): Clip => ({
  id: 'c',
  quelleId: 'q',
  in: 10,
  out: 20,
  name: 'c',
  freezeFrames: [],
  zeitlupen: [],
  ...o,
});

describe('Audio-Modell', () => {
  it('Standard: Original 100 %, Ducking an mit −12 dB, keine Spuren; holeAudio verändert den Clip nicht', () => {
    const c = clip();
    expect(holeAudio(c)).toEqual(standardAudio());
    expect(c.audio).toBeUndefined();
    expect(standardAudio().ducking).toEqual({ an: true, absenkungDb: -12 });
  });
  it('wählt eine freie Spur oder legt eine neue an', () => {
    const c = clip();
    const s1 = spurFuer(c, 1, 2);
    s1.segmente.push(segment('b1', 1, 2));
    expect(spurFuer(c, 5, 1, s1.id).id).toBe(s1.id); // frei → bevorzugte Spur
    const s2 = spurFuer(c, 2, 1, s1.id); // überlappt → neue Spur
    expect(s2.id).not.toBe(s1.id);
    expect(c.audio!.spuren.map((s) => s.name)).toEqual(['Spur 1', 'Spur 2']);
    expect(neueSpur(c, 'Trainer').name).toBe('Trainer');
  });
  it('Segment verschieben, vorne/hinten kürzen, nie über Blob oder Clip hinaus', () => {
    const seg = segment('b', 2, 4, 1); // start 2, dauer 4 (2–6), im Blob ab 1 s, Blob 8 s lang
    const clipDauer = 10;
    expect(aendereSegmentZeit(seg, 8, 3, 7, clipDauer)).toMatchObject({
      start: 3,
      dauer: 4,
      offset: 1,
    });
    expect(aendereSegmentZeit(seg, 8, 9, 13, clipDauer).start).toBe(6); // an Clipende geklemmt
    expect(aendereSegmentZeit(seg, 8, -3, 1, clipDauer).start).toBe(0);
    // vorne kürzen: Ende bleibt, Offset wächst
    expect(aendereSegmentZeit(seg, 8, 3, 6, clipDauer)).toMatchObject({
      start: 3,
      offset: 2,
      dauer: 3,
    });
    // vorne verlängern: nicht über den Blobanfang (offset 1 → max. 1 s)
    expect(aendereSegmentZeit(seg, 8, 0, 6, clipDauer)).toMatchObject({
      start: 1,
      offset: 0,
      dauer: 5,
    });
    // hinten kürzen / verlängern bis Blobende (8 − 1 = 7 s)
    expect(aendereSegmentZeit(seg, 8, 2, 4, clipDauer).dauer).toBe(2);
    expect(aendereSegmentZeit(seg, 8, 2, 9.5, clipDauer).dauer).toBe(7);
    expect(aendereSegmentZeit(seg, 8, 2, 2.01, clipDauer).dauer).toBe(0.1);
  });
  it('sammelt benutzte Blob-Ids', () => {
    const c = clip();
    spurFuer(c, 0, 1).segmente.push(segment('x', 0, 1), segment('y', 2, 1));
    expect([...benutzteBlobIds([c, clip()])].sort()).toEqual(['x', 'y']);
  });
});

function projekt(...clips: Clip[]): Projekt {
  const p = neuesProjekt('x');
  p.clips.push(...clips);
  return p;
}

describe('Audio-Plan', () => {
  it('ohne Kommentare: Original konstant bei Lautstärke; Stumm → 0', () => {
    const c = clip();
    c.audio = standardAudio();
    c.audio.original.lautstaerke = 0.8;
    const p = projekt(c);
    const a = audioPlan(clipPlan(c), p);
    expect(a.ereignisse).toEqual([]);
    expect(gainBei(a.original, 3)).toBeCloseTo(0.8);
    c.audio.original.stumm = true;
    expect(gainBei(audioPlan(clipPlan(c), p).original, 3)).toBe(0);
  });
  it('Standbild: Kommentar läuft weiter (Ereignis über die ganze Dauer)', () => {
    const c = clip({ freezeFrames: [{ zeit: 12, dauer: 3 }] }); // Standbild 2–5 s
    const sp = spurFuer(c, 2.5, 2);
    sp.segmente.push(segment('b', 2.5, 2));
    const a = audioPlan(clipPlan(c), projekt(c));
    expect(a.ereignisse).toHaveLength(1);
    expect(a.ereignisse[0]).toMatchObject({ start: 2.5, dauer: 2, offset: 0, gain: 1 });
  });
  it('Ducking: Original sinkt vor dem Kommentar auf −12 dB und steigt danach wieder', () => {
    const c = clip();
    spurFuer(c, 3, 2).segmente.push(segment('b', 3, 2)); // 3–5
    const a = audioPlan(clipPlan(c), projekt(c));
    const tief = Math.pow(10, -12 / 20);
    expect(gainBei(a.original, 1)).toBeCloseTo(1);
    expect(gainBei(a.original, 3 - DUCK_AB / 2)).toBeLessThan(1);
    expect(gainBei(a.original, 3)).toBeCloseTo(tief, 5);
    expect(gainBei(a.original, 4)).toBeCloseTo(tief, 5);
    expect(gainBei(a.original, 5 + DUCK_AUF / 2)).toBeGreaterThan(tief);
    expect(gainBei(a.original, 5 + DUCK_AUF + 0.01)).toBeCloseTo(1);
    expect(gainBei(a.original, 9)).toBeCloseTo(1);
    // einstellbar und abschaltbar
    c.audio!.ducking.absenkungDb = -6;
    expect(gainBei(audioPlan(clipPlan(c), projekt(c)).original, 4)).toBeCloseTo(
      Math.pow(10, -6 / 20),
      5,
    );
    c.audio!.ducking.an = false;
    expect(gainBei(audioPlan(clipPlan(c), projekt(c)).original, 4)).toBeCloseTo(1);
  });
  it('Nahe Kommentare werden zu einer Absenkung zusammengefasst', () => {
    const c = clip();
    const sp = spurFuer(c, 2, 1);
    sp.segmente.push(segment('a', 2, 1), segment('b', 3.2, 1));
    const a = audioPlan(clipPlan(c), projekt(c));
    expect(gainBei(a.original, 3.1)).toBeCloseTo(Math.pow(10, -12 / 20), 5);
  });
  it('Stumm/Solo/Lautstärke je Spur; Solo schaltet alles andere stumm (auch Original)', () => {
    const c = clip();
    const s1 = spurFuer(c, 0, 1);
    s1.segmente.push(segment('a', 0, 1));
    s1.lautstaerke = 0.5;
    const s2 = neueSpur(c);
    s2.segmente.push(segment('b', 2, 1));
    let a = audioPlan(clipPlan(c), projekt(c));
    expect(a.ereignisse.map((e) => [e.blobId, e.gain])).toEqual([
      ['a', 0.5],
      ['b', 1],
    ]);
    s1.stumm = true;
    expect(audioPlan(clipPlan(c), projekt(c)).ereignisse.map((e) => e.blobId)).toEqual(['b']);
    s1.stumm = false;
    s2.solo = true;
    a = audioPlan(clipPlan(c), projekt(c));
    expect(a.ereignisse.map((e) => e.blobId)).toEqual(['b']);
    expect(gainBei(a.original, 8)).toBe(0); // Original nicht solo → stumm
    c.audio!.original.solo = true;
    expect(gainBei(audioPlan(clipPlan(c), projekt(c)).original, 8)).toBe(1);
  });
  it('Kommentar über das Clipende hinaus wird abgeschnitten', () => {
    const c = clip(); // 10 s
    spurFuer(c, 8, 5).segmente.push(segment('b', 8, 5));
    const e = audioPlan(clipPlan(c), projekt(c)).ereignisse[0]!;
    expect(e.dauer).toBe(2);
  });
  it('Playlist: Ereignisse und Kurve liegen in Playlist-Zeit; Titelfolien sind stumm', () => {
    const a = clip({ id: 'a', in: 0, out: 4 });
    const b = clip({ id: 'b', in: 0, out: 6 });
    spurFuer(b, 1, 2).segmente.push(segment('x', 1, 2));
    b.audio!.original.lautstaerke = 0.5;
    const p = projekt(a, b);
    const zp = playlistZeitplan(
      {
        eintraege: [
          {
            id: '1',
            typ: 'titel',
            kicker: '',
            titel: 't',
            untertitel: '',
            dauer: 3,
            uebergang: 'schnitt',
          },
          { id: '2', typ: 'clip', clipId: 'a', uebergang: 'schnitt' },
          { id: '3', typ: 'clip', clipId: 'b', uebergang: 'schnitt' },
        ],
      },
      p.clips,
    );
    const ap = audioPlan(zp, p);
    expect(ap.ereignisse[0]).toMatchObject({ clipId: 'b', start: 3 + 4 + 1 });
    expect(gainBei(ap.original, 1)).toBe(0); // Titel
    expect(gainBei(ap.original, 4)).toBeCloseTo(1); // Clip a
    expect(gainBei(ap.original, 7.2)).toBeCloseTo(0.5); // Clip b vor dem Kommentar
    for (let i = 1; i < ap.original.length; i++)
      expect(ap.original[i]!.t).toBeGreaterThan(ap.original[i - 1]!.t);
  });
});

describe('Zeitabgleich der Kommentare', () => {
  it('Start folgt dem Videobild, Länge bleibt; passt nicht mehr → gekürzt oder entfernt', () => {
    const p = projekt(clip());
    spurFuer(p.clips[0]!, 5, 2).segmente.push(segment('b', 5, 2));
    mitZeichnungsAbgleich(p, 'c', (cl) => {
      cl.freezeFrames.push({ zeit: 12, dauer: 3 });
    });
    const s = p.clips[0]!.audio!.spuren[0]!.segmente[0]!;
    expect([s.start, s.dauer]).toEqual([8, 2]);
    // Clip hinten abschneiden: Kommentar ragt hinaus → gekürzt
    mitZeichnungsAbgleich(p, 'c', (cl) => {
      cl.out = 19; // Clipdauer 9 s inkl. Standbild 12 s
    });
    const s2 = p.clips[0]!.audio!.spuren[0]!.segmente[0]!;
    expect(s2.start + s2.dauer).toBeLessThanOrEqual(12);
  });
});

describe('Migration auf Version 6', () => {
  it('entfernt das alte projektweite audioSpuren-Feld', () => {
    const p = neuesProjekt('alt') as unknown as Record<string, unknown>;
    p.version = 5;
    p.audioSpuren = [{ id: 'x', typ: 'original' }];
    const m = migriere(p);
    expect(m.version).toBe(6);
    expect('audioSpuren' in m).toBe(false);
  });
});

import { wellenformPfad } from '../src/audio/wellenform';

describe('Wellenform-Pfad', () => {
  it('begrenzt die Punktzahl, spiegelt und schliesst den Pfad', () => {
    const peaks = Float32Array.from({ length: 1000 }, (_, i) => (i % 100) / 100);
    const { d, n } = wellenformPfad(peaks, 100, 0, 10, 200);
    expect(n).toBe(200);
    expect(d.startsWith('M0,')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.split('L').length).toBe(2 * n); // n-1 oben + n unten + das M
  });
  it('wählt den Ausschnitt und bleibt in den Grenzen', () => {
    const peaks = new Float32Array(100);
    peaks[50] = 1;
    const a = wellenformPfad(peaks, 100, 0.5, 0.52, 300);
    expect(a.n).toBe(2);
    expect(a.d).toContain(',0.000'); // Spitze 1 → oben bei y = 0
    expect(wellenformPfad(peaks, 100, 5, 6).n).toBe(1); // ausserhalb → leerer Ausschnitt, kein Absturz
    expect(wellenformPfad([], 100, 0, 1).d).toBeTruthy();
  });
});
