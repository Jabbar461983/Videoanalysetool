import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';

enablePatches();

export interface Befehl {
  name: string;
  patches: Patch[];
  inverse: Patch[];
}

export class Historie {
  private undoStapel: Befehl[] = [];
  private redoStapel: Befehl[] = [];
  constructor(private maxLaenge = 200) {}

  get kannUndo(): boolean {
    return this.undoStapel.length > 0;
  }
  get kannRedo(): boolean {
    return this.redoStapel.length > 0;
  }

  /** Wendet eine Änderung an und merkt sie sich. Gibt den neuen Zustand zurück. */
  ausfuehren<T extends object>(zustand: T, name: string, aenderung: (entwurf: T) => void): T {
    const [neu, patches, inverse] = produceWithPatches(zustand, aenderung);
    if (patches.length === 0) return zustand;
    this.undoStapel.push({ name, patches, inverse });
    if (this.undoStapel.length > this.maxLaenge) this.undoStapel.shift();
    this.redoStapel = [];
    return neu;
  }
  undo<T extends object>(zustand: T): T {
    const b = this.undoStapel.pop();
    if (!b) return zustand;
    this.redoStapel.push(b);
    return applyPatches(zustand, b.inverse);
  }
  redo<T extends object>(zustand: T): T {
    const b = this.redoStapel.pop();
    if (!b) return zustand;
    this.undoStapel.push(b);
    return applyPatches(zustand, b.patches);
  }
  leeren(): void {
    this.undoStapel = [];
    this.redoStapel = [];
  }
}
