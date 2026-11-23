export interface SpeicherInfo {
  genutzt: number;
  gesamt: number;
  dauerhaft: boolean;
}

export async function speicherInfo(): Promise<SpeicherInfo | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  const dauerhaft = (await navigator.storage.persisted?.()) ?? false;
  return { genutzt: e.usage ?? 0, gesamt: e.quota ?? 0, dauerhaft };
}
export async function bitteUmDauerhaftenSpeicher(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
export function formatBytes(n: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
}
