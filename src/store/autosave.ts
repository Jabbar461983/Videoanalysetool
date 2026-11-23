import { db } from '../db/db';
import { speichereProjekt } from '../db/projekte';
import type { Projekt } from '../model/typen';
import { useProjekt } from './projektStore';

export const SAVE_VERZUG_MS = 1000;
export const SAVE_MAX_MS = 2000;

const FLAG = 'bdva-sauber-beendet';
const setzeFlag = (v: boolean) => {
  try {
    localStorage.setItem(FLAG, v ? '1' : '0');
  } catch {
    /* ignorieren */
  }
};
export const warSauberBeendet = (): boolean => {
  try {
    return localStorage.getItem(FLAG) !== '0';
  } catch {
    return true;
  }
};

/** Entprelltes Speichern: spätestens SAVE_MAX_MS nach der ersten ungesicherten Änderung. */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private letztes: Projekt | null = null;
  private laeuft: Promise<void> = Promise.resolve();

  constructor(
    private speichern: (p: Projekt) => Promise<void>,
    private verzug = SAVE_VERZUG_MS,
    private maxVerzug = SAVE_MAX_MS,
  ) {}

  melde(p: Projekt): void {
    this.letztes = p;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.verzug);
    if (!this.maxTimer) this.maxTimer = setTimeout(() => void this.flush(), this.maxVerzug);
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.timer = this.maxTimer = null;
    const p = this.letztes;
    this.letztes = null;
    if (!p) return this.laeuft;
    this.laeuft = this.laeuft.then(() => this.speichern(p));
    return this.laeuft;
  }
}

let aktiv: { stop: () => void } | null = null;

/** Hängt Autosave an den Store. Gibt eine Funktion zum Beenden zurück. */
export function starteAutosave(): () => void {
  aktiv?.stop();
  const saver = new Autosaver(async (p) => {
    try {
      await speichereProjekt(p);
      // Schattenkopie für «Letzten Stand wiederherstellen»
      await db.wiederherstellung.put({ projektId: p.id, zeitpunkt: Date.now(), projekt: p });
      if (useProjekt.getState().projekt?.geaendertAm === p.geaendertAm) {
        useProjekt.getState().setzeStatus('gespeichert');
      }
    } catch {
      useProjekt.getState().setzeStatus('fehler');
    }
  });
  setzeFlag(false); // gilt als «läuft»; wird beim sauberen Verlassen wieder gesetzt
  const unsub = useProjekt.subscribe((s, prev) => {
    if (s.projekt && s.projekt !== prev.projekt && s.projekt.id === prev.projekt?.id)
      saver.melde(s.projekt);
  });
  const beimVerlassen = () => {
    void saver.flush();
  };
  const sichtbar = () => {
    if (document.visibilityState === 'hidden') beimVerlassen();
  };
  const sauber = () => {
    beimVerlassen();
    setzeFlag(true);
  };
  window.addEventListener('pagehide', sauber);
  document.addEventListener('visibilitychange', sichtbar);
  const stop = () => {
    unsub();
    window.removeEventListener('pagehide', sauber);
    document.removeEventListener('visibilitychange', sichtbar);
    void saver.flush();
    setzeFlag(true);
    aktiv = null;
  };
  aktiv = { stop };
  return stop;
}
