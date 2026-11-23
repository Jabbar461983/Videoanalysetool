export interface Features {
  webcodecs: boolean;
  webgpu: boolean;
  fsAccess: boolean;
  saveFilePicker: boolean;
  persist: boolean;
  h264: boolean;
  hevc: boolean;
}

const mitCanPlay = (v: HTMLVideoElement, t: string) => v.canPlayType(t) !== '';

export async function erkenneFeatures(): Promise<Features> {
  const w = window as unknown as Record<string, unknown>;
  const v = document.createElement('video');
  let h264 = mitCanPlay(v, 'video/mp4; codecs="avc1.640028"');
  let hevc =
    mitCanPlay(v, 'video/mp4; codecs="hvc1.1.6.L93.B0"') ||
    mitCanPlay(v, 'video/mp4; codecs="hev1.1.6.L93.B0"');
  if (typeof VideoDecoder !== 'undefined') {
    try {
      h264 =
        h264 || (await VideoDecoder.isConfigSupported({ codec: 'avc1.640028' })).supported === true;
    } catch {
      /* egal */
    }
    try {
      hevc =
        hevc ||
        (await VideoDecoder.isConfigSupported({ codec: 'hvc1.1.6.L93.B0' })).supported === true;
    } catch {
      /* egal */
    }
  }
  return {
    webcodecs: typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined',
    webgpu: 'gpu' in navigator,
    fsAccess: typeof w.showOpenFilePicker === 'function',
    saveFilePicker: typeof w.showSaveFilePicker === 'function',
    persist: typeof navigator.storage?.persist === 'function',
    h264,
    hevc,
  };
}

/** Kann der Browser diesen Codec-Namen (Mediabunny: 'avc','hevc','vp9','av1', …) abspielen? */
export function codecAbspielbar(codec: string, f: Features): boolean {
  if (codec === 'hevc') return f.hevc;
  if (codec === 'avc') return f.h264;
  return true; // vp8/vp9/av1: Browser meldet bei Fehler selbst
}
