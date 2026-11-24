import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { neueId } from '../model/schema';
import type { Kalibrierung } from '../model/typen';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { aktuellesBild, type StandbildInfo } from '../taktik/bild';
import { referenzPunkte } from '../taktik/feld';
import { berechneKalibrierung, bewerteKalibrierung, type PunktPaar } from '../taktik/homographie';
import { formatZeit } from '../video/bildmathe';
import { zeichneFeldAufBild } from '../taktik/bildFeld';

interface Paar extends PunktPaar {
  punktId: string;
}

/** Dialog: im Standbild mindestens 4 Feldpunkte anklicken → Homographie, Qualität und Kontrolllinien. */
export function KalibrierDialog() {
  const offen = useTaktik((x) => x.kalibrierungOffen);
  const projekt = useProjekt((x) => x.projekt);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bild, setBild] = useState<StandbildInfo | null>(null);
  const [paare, setPaare] = useState<Paar[]>([]);
  const [aktuell, setAktuell] = useState<string>('bully-ol');
  const [name, setName] = useState('');
  const feld = projekt?.taktik.feld;
  const punkte = useMemo(() => (feld ? referenzPunkte(feld) : []), [feld]);

  useEffect(() => {
    if (!offen) return;
    const b = aktuellesBild();
    setBild(b);
    setPaare([]);
    setAktuell('bully-ol');
    const q = projekt?.quellen.find((x) => x.id === b?.quelleId);
    setName(b && q ? `${q.dateiname} – ${formatZeit(b.quellZeit, q.fps)}` : 'Kamera');
  }, [offen]); // eslint-disable-line react-hooks/exhaustive-deps

  const ergebnis = useMemo(() => (paare.length >= 4 ? berechneKalibrierung(paare) : null), [paare]);

  // Standbild + Marken + Kontrolllinien (Feld auf das Bild zurückprojiziert)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !bild || !feld) return;
    const B = 960;
    const H = Math.round((B * bild.frame.height) / bild.frame.width);
    c.width = B;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bild.frame, 0, 0, B, H);
    if (ergebnis) zeichneFeldAufBild(ctx, ergebnis.H, feld, B, H);
    paare.forEach((p, i) => {
      const x = p.bild.x * B;
      const y = p.bild.y * H;
      ctx.strokeStyle = '#E53935';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(String(i + 1), x + 8, y - 8);
    });
  }, [bild, paare, ergebnis, feld]);

  if (!offen || !projekt || !feld) return null;
  const schliesse = () => useTaktik.getState().setze({ kalibrierungOffen: false });
  const naechster = (benutzt: Set<string>) => punkte.find((p) => !benutzt.has(p.id))?.id ?? aktuell;
  const guete = ergebnis
    ? bewerteKalibrierung(ergebnis, Math.hypot(feld.laenge, feld.breite))
    : null;

  const klick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const bildPos = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const ref = punkte.find((p) => p.id === aktuell);
    if (!ref) return;
    const neu = [
      ...paare.filter((p) => p.punktId !== ref.id),
      { punktId: ref.id, bild: bildPos, feld: { x: ref.x, y: ref.y } },
    ];
    setPaare(neu);
    setAktuell(naechster(new Set(neu.map((p) => p.punktId))));
  };

  const speichern = () => {
    if (!ergebnis || !bild) return;
    const k: Kalibrierung = {
      id: neueId(),
      name: name.trim() || 'Kalibrierung',
      quelleId: bild.quelleId,
      zeit: bild.quellZeit,
      paare: paare.map((p) => ({ punktId: p.punktId, bild: p.bild, feld: p.feld })),
      H: ergebnis.H,
      rms: ergebnis.rms,
    };
    useProjekt.getState().aendere('Kalibrierung', (p) => {
      p.taktik.kalibrierungen.push(k);
      p.taktik.aktiveKalibrierung[k.quelleId] = k.id;
    });
    schliesse();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.taktik.kalibrierung}
      data-testid="kalibrier-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        zIndex: 85,
        display: 'grid',
        placeItems: 'center',
        padding: 12,
      }}
    >
      <div
        style={{
          background: 'var(--bd-surface-raised)',
          border: '1px solid var(--bd-rule)',
          padding: 16,
          width: 'min(1240px, 100%)',
          maxHeight: '100%',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <strong className="kicker">{t.taktik.kalibrierung}</strong>
          <span style={{ flex: 1 }} />
          <button onClick={schliesse}>{t.taktik.abbrechen}</button>
          <button
            className="primaer"
            disabled={!ergebnis}
            data-testid="kalibrierung-speichern"
            onClick={speichern}
          >
            {t.taktik.speichern}
          </button>
        </div>
        {!bild ? (
          <p className="hinweis">{t.taktik.keinBild}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 12 }}>
            <div>
              <canvas
                ref={canvasRef}
                data-testid="kalibrier-bild"
                style={{ width: '100%', cursor: 'crosshair', border: '1px solid var(--bd-rule)' }}
                onPointerDown={klick}
              />
              <p className="hinweis">{t.taktik.kalibrierHilfe}</p>
            </div>
            <div>
              <label>
                {t.taktik.kalibrierName}
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
              <p className="kicker" style={{ marginTop: 8 }}>
                {t.taktik.punkte} ({paare.length}/4+)
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  maxHeight: 320,
                  overflow: 'auto',
                }}
                data-testid="referenzpunkte"
              >
                {punkte.map((p) => {
                  const gesetzt = paare.find((x) => x.punktId === p.id);
                  return (
                    <li key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        aria-pressed={aktuell === p.id}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          ...(aktuell === p.id
                            ? { borderColor: 'var(--bd-gold)', color: 'var(--bd-gold)' }
                            : {}),
                        }}
                        onClick={() => setAktuell(p.id)}
                      >
                        {gesetzt ? '✓ ' : ''}
                        {p.name}
                      </button>
                      {gesetzt && (
                        <button
                          aria-label={t.taktik.punktEntfernen}
                          onClick={() => setPaare(paare.filter((x) => x.punktId !== p.id))}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div style={{ marginTop: 8 }} data-testid="kalibrier-guete" role="status">
                {paare.length < 4 && (
                  <span className="hinweis">{t.taktik.nochPunkte(4 - paare.length)}</span>
                )}
                {paare.length >= 4 && !ergebnis && (
                  <span style={{ color: '#E53935' }}>{t.taktik.entartet}</span>
                )}
                {ergebnis && (
                  <span>
                    {guete === 'ungeprueft'
                      ? t.taktik.guete4
                      : `${t.taktik.fehler}: ${ergebnis.rms!.toFixed(2)} m (max. ${ergebnis.maxFehler!.toFixed(2)} m) · ${t.taktik.gueteStufen[guete!]}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
