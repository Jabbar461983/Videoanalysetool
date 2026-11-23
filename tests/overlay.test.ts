import { SCHEMA_VERSION } from '../src/model/typen';
import { describe, expect, it } from 'vitest';
import { migriere, neuesProjekt } from '../src/model/schema';
import { spielstand, toreOhneTeam } from '../src/overlay/spielstand';
import { fuegeAusblendenHinzu, istAusgeblendet } from '../src/overlay/ausblenden';
import { mitZeichnungsAbgleich } from '../src/zeichnen/logik';
import type { Clip, Projekt } from '../src/model/typen';

const quelle = (id: string) => ({
  id,
  dateiname: id,
  groesse: 1,
  teilHash: id,
  dauer: 3000,
  fps: 25,
  breite: 1,
  hoehe: 1,
  codec: 'avc',
});

function projekt(): Projekt {
  const p = neuesProjekt('x');
  p.quellen.push(quelle('h1'), quelle('h2'));
  return p;
}
const tor = (p: Projekt) => p.tagDefinitionen.find((d) => d.istTor)!.id;
const fehler = (p: Projekt) => p.tagDefinitionen.find((d) => !d.istTor)!.id;
let n = 0;
const tag = (p: Projekt, defId: string, quelleId: string, zeit: number, team?: 0 | 1) =>
  p.tags.push({
    id: `t${n++}`,
    defId,
    quelleId,
    zeit,
    teamId: team === undefined ? undefined : p.teams[team].id,
  });

describe('Spielstand', () => {
  it('Startstand ohne Tore', () => {
    const p = projekt();
    expect(spielstand(p, 'h1', 10)).toEqual([0, 0]);
    p.einstellungen.startstand = [2, 1];
    expect(spielstand(p, 'h1', 10)).toEqual([2, 1]);
  });
  it('zählt Tor-Tags je Team bis einschliesslich t, ignoriert andere Tags', () => {
    const p = projekt();
    tag(p, tor(p), 'h1', 100, 0);
    tag(p, tor(p), 'h1', 200, 1);
    tag(p, tor(p), 'h1', 300, 0);
    tag(p, fehler(p), 'h1', 150, 0);
    expect(spielstand(p, 'h1', 99.9)).toEqual([0, 0]);
    expect(spielstand(p, 'h1', 100)).toEqual([1, 0]);
    expect(spielstand(p, 'h1', 250)).toEqual([1, 1]);
    expect(spielstand(p, 'h1', 1000)).toEqual([2, 1]);
  });
  it('Tore der 1. Halbzeit zählen in der 2. Halbzeit; spätere Quellen beeinflussen frühere nicht', () => {
    const p = projekt();
    tag(p, tor(p), 'h1', 500, 0);
    tag(p, tor(p), 'h2', 50, 1);
    expect(spielstand(p, 'h1', 3000)).toEqual([1, 0]);
    expect(spielstand(p, 'h2', 10)).toEqual([1, 0]);
    expect(spielstand(p, 'h2', 50)).toEqual([1, 1]);
  });
  it('Tore ohne Team zählen nicht und werden gemeldet', () => {
    const p = projekt();
    tag(p, tor(p), 'h1', 10);
    tag(p, tor(p), 'h1', 20, 1);
    expect(spielstand(p, 'h1', 100)).toEqual([0, 1]);
    expect(toreOhneTeam(p)).toBe(1);
  });
  it('Korrektur setzt den Stand fest; spätere Tore zählen weiter; Korrektur schlägt Tor zur selben Zeit', () => {
    const p = projekt();
    tag(p, tor(p), 'h1', 100, 0);
    tag(p, tor(p), 'h1', 300, 1);
    p.overlays.scoreKorrekturen.push({ id: 'k', quelleId: 'h1', zeit: 200, stand: [5, 4] });
    expect(spielstand(p, 'h1', 150)).toEqual([1, 0]);
    expect(spielstand(p, 'h1', 200)).toEqual([5, 4]);
    expect(spielstand(p, 'h1', 350)).toEqual([5, 5]);
    p.overlays.scoreKorrekturen.push({ id: 'k2', quelleId: 'h1', zeit: 300, stand: [7, 7] });
    expect(spielstand(p, 'h1', 300)).toEqual([7, 7]);
    expect(spielstand(p, 'h2', 0)).toEqual([7, 7]);
  });
  it('unbekannte Quelle liefert den Startstand', () => {
    expect(spielstand(projekt(), 'gibtsnicht', 1)).toEqual([0, 0]);
  });
});

const clip = (o: Partial<Clip> = {}): Clip => ({
  id: 'c',
  quelleId: 'h1',
  in: 10,
  out: 20,
  name: 'c',
  freezeFrames: [],
  zeitlupen: [],
  ...o,
});

describe('Ausblenden', () => {
  it('prüft Abschnitte (Ende exklusiv) und führt Überlappungen zusammen', () => {
    const c = clip();
    expect(istAusgeblendet(c.ausblenden?.logo, 1)).toBe(false);
    expect(fuegeAusblendenHinzu(c, 'logo', 2, 4)).toBe(true);
    expect(fuegeAusblendenHinzu(c, 'logo', 3.5, 6)).toBe(true);
    expect(fuegeAusblendenHinzu(c, 'logo', 8, 9)).toBe(true);
    expect(c.ausblenden!.logo).toEqual([
      { start: 2, ende: 6 },
      { start: 8, ende: 9 },
    ]);
    expect(istAusgeblendet(c.ausblenden!.logo, 2)).toBe(true);
    expect(istAusgeblendet(c.ausblenden!.logo, 6)).toBe(false);
    expect(istAusgeblendet(c.ausblenden!.scoreboard, 3)).toBe(false);
    expect(fuegeAusblendenHinzu(c, 'scoreboard', 1, 1.05)).toBe(false);
  });
  it('folgen dem Clip bei Standbild und Trimmen (am selben Videobild)', () => {
    const p = projekt();
    const c = clip();
    p.clips.push(c);
    fuegeAusblendenHinzu(c, 'scoreboard', 5, 8); // Quellzeit 15–18
    mitZeichnungsAbgleich(p, 'c', (cl) => {
      cl.freezeFrames.push({ zeit: 12, dauer: 3 });
    });
    expect(p.clips[0]!.ausblenden!.scoreboard).toEqual([{ start: 8, ende: 11 }]);
    mitZeichnungsAbgleich(p, 'c', (cl) => {
      cl.in = 14; // 4 s weniger am Anfang, Standbild bei 12 fällt weg
      cl.freezeFrames = [];
    });
    expect(p.clips[0]!.ausblenden!.scoreboard).toEqual([{ start: 1, ende: 4 }]);
  });
});

describe('Migration auf Version 5', () => {
  it('ergänzt Overlay-Einstellungen, erhält vorhandene Werte', () => {
    const p = neuesProjekt('alt') as unknown as Record<string, unknown>;
    p.version = 4;
    p.overlays = { logo: [], scoreboard: [], scoreKorrekturen: [] };
    p.einstellungen = { trackingModus: 'auto', exportAufloesung: 1080, zeichnenAnhalten: false };
    const m = migriere(p);
    expect(m.version).toBe(SCHEMA_VERSION);
    expect(m.einstellungen).toMatchObject({
      zeichnenAnhalten: false,
      logoAnzeigen: true,
      logoGroesse: 10,
      scoreboardAnzeigen: true,
      startstand: [0, 0],
    });
    expect(m.overlays).toEqual({ scoreKorrekturen: [] });
  });
});
