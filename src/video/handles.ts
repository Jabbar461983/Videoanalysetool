import { db } from '../db/db';

type PickerWindow = Window & {
  showOpenFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle[]>;
};

export const hatFsAccess = (): boolean =>
  typeof (window as PickerWindow).showOpenFilePicker === 'function';

/** Dateidialog; mit File System Access wird zusätzlich ein Handle zurückgegeben. */
export async function waehleVideos(
  multiple = true,
): Promise<{ datei: File; handle?: FileSystemFileHandle }[]> {
  const w = window as PickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const hs = await w.showOpenFilePicker({
        multiple,
        types: [
          {
            description: 'Video',
            accept: { 'video/*': ['.mp4', '.mov', '.m4v', '.webm', '.mkv'] },
          },
        ],
      });
      return Promise.all(hs.map(async (handle) => ({ handle, datei: await handle.getFile() })));
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return [];
      throw e;
    }
  }
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'video/*,.mkv,.mov';
    inp.multiple = multiple;
    inp.onchange = () => resolve([...(inp.files ?? [])].map((datei) => ({ datei })));
    inp.oncancel = () => resolve([]);
    inp.click();
  });
}

/** Handle aus Drag & Drop (nur Chromium). */
export async function handleAusDrop(
  item: DataTransferItem,
): Promise<FileSystemFileHandle | undefined> {
  const fn = (
    item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }
  ).getAsFileSystemHandle;
  if (!fn) return undefined;
  try {
    const h = await fn.call(item);
    return h?.kind === 'file' ? (h as FileSystemFileHandle) : undefined;
  } catch {
    return undefined;
  }
}

export const speichereHandle = (key: string, handle: FileSystemFileHandle) =>
  db.handles.put({ quelleKey: key, handle });

type PermHandle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
};

/** Versucht die Datei zu holen. `fragen=true` darf einen Berechtigungsdialog auslösen (braucht Nutzergeste). */
export async function holeDateiVonHandle(key: string, fragen: boolean): Promise<File | null> {
  const row = await db.handles.get(key);
  if (!row) return null;
  const h = row.handle as PermHandle;
  try {
    let p = (await h.queryPermission?.({ mode: 'read' })) ?? 'granted';
    if (p !== 'granted' && fragen) p = (await h.requestPermission?.({ mode: 'read' })) ?? 'denied';
    if (p !== 'granted') return null;
    return await h.getFile();
  } catch {
    return null;
  }
}
