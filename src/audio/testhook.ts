import { useProjekt } from '../store/projektStore';
import { aktuellerPlan } from '../wiedergabe/transport';
import { mixdownRender } from './mixdown';
import { audioPlan } from './plan';
import { holeBuffer } from './speicher';

/** Nur für automatische Tests: wird nur geladen, wenn `localStorage['bdva-test'] === '1'`. */
(window as unknown as Record<string, unknown>).__bdvaTest = {
  async mixdownKommentare(): Promise<{ dauer: number; rmsProSekunde: number[]; kanaele: number }> {
    const plan = aktuellerPlan();
    const projekt = useProjekt.getState().projekt;
    if (!plan || !projekt) throw new Error('Kein Programm geöffnet');
    const buf = await mixdownRender(plan, projekt, { sampleRate: 16000, ladeBuffer: holeBuffer });
    const d = buf.getChannelData(0);
    const rms: number[] = [];
    for (let s = 0; s < Math.floor(buf.duration); s++) {
      let q = 0;
      for (let i = s * buf.sampleRate; i < (s + 1) * buf.sampleRate; i++) q += d[i]! * d[i]!;
      rms.push(Math.sqrt(q / buf.sampleRate));
    }
    return { dauer: buf.duration, rmsProSekunde: rms, kanaele: buf.numberOfChannels };
  },
  audioPlan(): unknown {
    const plan = aktuellerPlan();
    const projekt = useProjekt.getState().projekt;
    return plan && projekt ? audioPlan(plan, projekt) : null;
  },
};
