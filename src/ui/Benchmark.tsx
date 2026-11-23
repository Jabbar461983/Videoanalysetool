import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { SAM_MODELLE } from '../ki/modelle';
import { SamClient } from '../ki/sam';
import { TrackingLauf } from '../ki/tracking';
import type { SpurPunkt } from '../ki/trackingTypen';
import { ausschnittRahmen, bereinigeMaske, maskenFlaeche } from '../ki/ausschnitt';

interface Zeile {
  id: string;
  anzeige: string;
  mb: number;
  ladeMs: number;
  einbettenMs: number;
  maskeMs: number;
  flaeche: number;
  geraet: string;
  maskeUrl: string;
  fehler?: string;
}

/** Maske als halbtransparente Farbe über den Ausschnitt (Anzeige). */
function maskeAlsBild(maske: Uint8Array, b: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const d = ctx.createImageData(b, h);
  for (let i = 0; i < maske.length; i++) {
    if (maske[i]) {
      d.data[i * 4] = 186;
      d.data[i * 4 + 1] = 153;
      d.data[i * 4 + 2] = 14;
      d.data[i * 4 + 3] = 170;
    }
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL();
}

/** Technische Seite #/benchmark: misst Ladezeit, Einbetten und Maske je Modell auf einem Standbild. */
export function Benchmark() {
  const [bild, setBild] = useState<ImageBitmap | null>(null);
  const [klick, setKlick] = useState<{ x: number; y: number } | null>(null);
  const [geraet, setGeraet] = useState<'auto' | 'wasm' | 'webgpu'>('auto');
  const [laeuft, setLaeuft] = useState(false);
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [status, setStatus] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !bild) return;
    c.width = bild.width;
    c.height = bild.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bild, 0, 0);
    if (klick) {
      ctx.strokeStyle = '#BA990E';
      ctx.lineWidth = Math.max(2, bild.width / 300);
      ctx.beginPath();
      ctx.arc(klick.x, klick.y, bild.width / 120, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [bild, klick]);

  const laden = async (f: File | undefined) => {
    if (!f) return;
    setBild(await createImageBitmap(f));
    setKlick(null);
    setZeilen([]);
  };

  const messen = async () => {
    if (!bild || !klick) return;
    setLaeuft(true);
    setZeilen([]);
    const rahmen = ausschnittRahmen(bild.width, bild.height, klick.x, klick.y);
    for (const m of SAM_MODELLE) {
      setStatus(`${m.anzeige} …`);
      const client = new SamClient();
      try {
        const t0 = performance.now();
        await client.lade(m.id, geraet);
        const ladeMs = performance.now() - t0;
        const ausschnitt = await createImageBitmap(bild, rahmen.x, rahmen.y, rahmen.b, rahmen.h);
        const einbettenMs = await client.einbetten(ausschnitt);
        const r = await client.maske([{ x: klick.x - rahmen.x, y: klick.y - rahmen.y, label: 1 }]);
        const sauber = bereinigeMaske(
          r.maske,
          r.breite,
          r.hoehe,
          klick.x - rahmen.x,
          klick.y - rahmen.y,
        );
        const z: Zeile = {
          id: m.id,
          anzeige: m.anzeige,
          mb: m.mb,
          ladeMs,
          einbettenMs,
          maskeMs: r.ms,
          flaeche: maskenFlaeche(sauber) / (r.breite * r.hoehe),
          geraet: client.stand.geraet ?? '?',
          maskeUrl: maskeAlsBild(sauber, r.breite, r.hoehe),
        };
        setZeilen((x) => [...x, z]);
      } catch (e) {
        setZeilen((x) => [
          ...x,
          {
            id: m.id,
            anzeige: m.anzeige,
            mb: m.mb,
            ladeMs: 0,
            einbettenMs: 0,
            maskeMs: 0,
            flaeche: 0,
            geraet: '-',
            maskeUrl: '',
            fehler: e instanceof Error ? e.message : String(e),
          },
        ]);
      } finally {
        client.beende();
      }
    }
    setStatus('');
    setLaeuft(false);
  };

  const ausschnitt =
    bild && klick ? ausschnittRahmen(bild.width, bild.height, klick.x, klick.y) : null;

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }} data-testid="benchmark">
      <p className="kicker">{t.benchmark.kicker}</p>
      <h1>{t.benchmark.titel}</h1>
      <p>{t.benchmark.hinweis}</p>
      <p>
        <a href="#/">{t.benchmark.zurueck}</a>
      </p>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          margin: '12px 0',
        }}
      >
        <label>
          {t.benchmark.bildWaehlen}{' '}
          <input
            type="file"
            accept="image/*"
            data-testid="bm-bild"
            onChange={(e) => void laden(e.target.files?.[0])}
          />
        </label>
        <label>
          {t.benchmark.geraet}{' '}
          <select value={geraet} onChange={(e) => setGeraet(e.target.value as typeof geraet)}>
            <option value="auto">Automatisch</option>
            <option value="webgpu">WebGPU</option>
            <option value="wasm">CPU (WASM)</option>
          </select>
        </label>
        <button
          className="primaer"
          disabled={!bild || !klick || laeuft}
          onClick={() => void messen()}
          data-testid="bm-start"
        >
          {laeuft ? t.benchmark.laeuft : t.benchmark.starten}
        </button>
        <span aria-live="polite">{status}</span>
      </div>
      {bild && (
        <>
          <p>{t.benchmark.klickHinweis}</p>
          <canvas
            ref={canvas}
            data-testid="bm-canvas"
            style={{ maxWidth: '100%', cursor: 'crosshair', border: '1px solid var(--bd-rule)' }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setKlick({
                x: Math.round(((e.clientX - r.left) / r.width) * bild.width),
                y: Math.round(((e.clientY - r.top) / r.height) * bild.height),
              });
            }}
          />
        </>
      )}
      <TrackingTest />
      {zeilen.length > 0 && (
        <table
          data-testid="bm-tabelle"
          style={{ marginTop: 16, borderCollapse: 'collapse', width: '100%' }}
        >
          <thead>
            <tr>
              {t.benchmark.spalten.map((s) => (
                <th
                  key={s}
                  style={{
                    textAlign: 'left',
                    borderBottom: '1px solid var(--bd-rule)',
                    padding: 6,
                  }}
                >
                  {s}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.id} data-testid={`bm-zeile-${z.id}`}>
                <td style={{ padding: 6 }}>{z.anzeige}</td>
                <td>{z.mb} MB</td>
                <td>{z.fehler ? z.fehler : `${(z.ladeMs / 1000).toFixed(1)} s`}</td>
                <td>{z.fehler ? '' : `${Math.round(z.einbettenMs)} ms`}</td>
                <td>{z.fehler ? '' : `${Math.round(z.maskeMs)} ms`}</td>
                <td>{z.fehler ? '' : `${(z.flaeche * 100).toFixed(1)} %`}</td>
                <td>{z.geraet}</td>
                <td>
                  {z.maskeUrl && ausschnitt && bild && (
                    <MaskenVorschau bild={bild} rahmen={ausschnitt} maskeUrl={z.maskeUrl} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function MaskenVorschau(p: {
  bild: ImageBitmap;
  rahmen: { x: number; y: number; b: number; h: number };
  maskeUrl: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 200;
    c.height = 200;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(p.bild, p.rahmen.x, p.rahmen.y, p.rahmen.b, p.rahmen.h, 0, 0, 200, 200);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, 200, 200);
    img.src = p.maskeUrl;
  }, [p.bild, p.rahmen, p.maskeUrl]);
  return <canvas ref={ref} style={{ width: 120, height: 120 }} />;
}

/** Tracking-Test: Videodatei, Startposition (Pixel) und Dauer – zeigt Spur und Zeiten. */
export function TrackingTest() {
  const [datei, setDatei] = useState<File | null>(null);
  const [f, setF] = useState({ zeit: 0, cx: 640, cy: 360, b: 50, h: 130, dauer: 4 });
  const [laeuft, setLaeuft] = useState(false);
  const [text, setText] = useState('');
  const [punkte, setPunkte] = useState<SpurPunkt[]>([]);
  const zahl = (k: keyof typeof f) => (
    <label style={{ marginRight: 8 }}>
      {k}{' '}
      <input
        type="number"
        value={f[k]}
        style={{ width: 70 }}
        data-testid={`bm-t-${k}`}
        onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
      />
    </label>
  );
  const start = async () => {
    if (!datei) return;
    setLaeuft(true);
    setText('Läuft …');
    setPunkte([]);
    const lauf = new TrackingLauf({
      beiFortschritt: (p) => setText(`Modell lädt … ${p} %`),
      beiLauf: (a) => setText(`Verfolgt … ${Math.round(a * 100)} %`),
    });
    try {
      const t0 = performance.now();
      const r = await lauf.verfolge({
        datei,
        startZeit: f.zeit,
        startBox: { cx: f.cx, cy: f.cy, b: f.b, h: f.h },
        von: Math.max(0, f.zeit - f.dauer / 2),
        bis: f.zeit + f.dauer,
      });
      setPunkte(r.punkte);
      const verloren = r.punkte.filter((p) => p.zustand === 'verloren').length;
      setText(
        `Fertig: ${r.punkte.length} Punkte, ${verloren} verloren, Erkennung ${Math.round(r.medianMs)} ms/Bild, gesamt ${((performance.now() - t0) / 1000).toFixed(1)} s`,
      );
    } catch (e) {
      setText(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <section style={{ marginTop: 32 }} data-testid="bm-tracking">
      <h2>Tracking-Test</h2>
      <p>Videodatei wählen, Position des Spielers in Pixeln des Videobilds angeben und starten.</p>
      <input
        type="file"
        accept="video/*"
        data-testid="bm-t-datei"
        onChange={(e) => setDatei(e.target.files?.[0] ?? null)}
      />
      <div style={{ margin: '8px 0' }}>
        {zahl('zeit')}
        {zahl('cx')}
        {zahl('cy')}
        {zahl('b')}
        {zahl('h')}
        {zahl('dauer')}
        <button
          className="primaer"
          disabled={!datei || laeuft}
          onClick={() => void start()}
          data-testid="bm-t-start"
        >
          Verfolgen
        </button>
      </div>
      <p aria-live="polite" data-testid="bm-t-status">
        {text}
      </p>
      <pre data-testid="bm-t-json" style={{ maxHeight: 240, overflow: 'auto', fontSize: 11 }}>
        {punkte.length
          ? JSON.stringify(
              punkte.map((p) => [
                Number(p.zeit.toFixed(2)),
                Math.round(p.box.cx),
                Math.round(p.box.cy),
                p.zustand,
              ]),
            )
          : ''}
      </pre>
    </section>
  );
}
