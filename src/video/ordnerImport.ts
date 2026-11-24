import { db } from '../db/db';

/** Videos aus einem Ordner des Geräts auswählen (File System Access, nur Chrome/Edge). */
export const VIDEO_ENDUNGEN = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'] as const;

export const istVideoName = (name: string): boolean => {
  const n = name.toLowerCase();
  return !n.startsWith('.') && VIDEO_ENDUNGEN.some((e) => n.endsWith(e));
};

type PickerWindow = Window & {
  showDirectoryPicker?: (o?: { mode?: 'read'; id?: string }) => Promise<FileSystemDirectoryHandle>;
  /** Nur für automatische Tests (mit `localStorage['bdva-test']`): ersetzt den Ordnerdialog */
  __bdvaTestOrdner?: FileSystemDirectoryHandle;
};

const testModus = (): boolean => {
  try {
    return localStorage.getItem('bdva-test') === '1';
  } catch {
    return false;
  }
};

export const hatOrdnerAuswahl = (): boolean =>
  typeof (window as PickerWindow).showDirectoryPicker === 'function' ||
  (testModus() && !!(window as PickerWindow).__bdvaTestOrdner);

/** Ordnerdialog; `null`, wenn abgebrochen. */
export async function waehleOrdner(): Promise<FileSystemDirectoryHandle | null> {
  const w = window as PickerWindow;
  if (testModus() && w.__bdvaTestOrdner) return w.__bdvaTestOrdner;
  if (!w.showDirectoryPicker) return null;
  try {
    return await w.showDirectoryPicker({ mode: 'read', id: 'bdva-videos' });
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    throw e;
  }
}

const ORDNER_KEY = '__ordner__';
// Die Tabelle «handles» ist für Dateien gedacht; ein Ordner-Handle wird gleich abgelegt (strukturiertes Klonen).
export const speichereOrdner = (h: FileSystemDirectoryHandle) =>
  db.handles.put({ quelleKey: ORDNER_KEY, handle: h as unknown as FileSystemFileHandle });
export async function ladeLetztenOrdner(): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.handles.get(ORDNER_KEY);
  return (row?.handle as unknown as FileSystemDirectoryHandle) ?? null;
}

type PermHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
};
/** Darf gelesen werden? `fragen` löst ggf. den Berechtigungsdialog aus (braucht eine Nutzergeste). */
export async function ordnerErlaubt(
  h: FileSystemDirectoryHandle,
  fragen: boolean,
): Promise<boolean> {
  const p = h as PermHandle;
  try {
    let s = (await p.queryPermission?.({ mode: 'read' })) ?? 'granted';
    if (s !== 'granted' && fragen) s = (await p.requestPermission?.({ mode: 'read' })) ?? 'denied';
    return s === 'granted';
  } catch {
    return false;
  }
}

export interface OrdnerVideo {
  name: string;
  groesse: number;
  geaendert: number;
  handle: FileSystemFileHandle;
}

/** Videodateien direkt im Ordner (ohne Unterordner), neueste zuerst. */
export async function listeVideos(dir: FileSystemDirectoryHandle): Promise<OrdnerVideo[]> {
  const out: OrdnerVideo[] = [];
  const iter = (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const e of iter) {
    if (e.kind !== 'file' || !istVideoName(e.name)) continue;
    try {
      const f = await (e as FileSystemFileHandle).getFile();
      out.push({
        name: e.name,
        groesse: f.size,
        geaendert: f.lastModified,
        handle: e as FileSystemFileHandle,
      });
    } catch {
      /* nicht lesbar */
    }
  }
  return out.sort((a, b) => b.geaendert - a.geaendert);
}
