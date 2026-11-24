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
import { pruefePlausibilitaet } from '../taktik/homographie';
import { zeichneFeldAufBild } from '../taktik/bildFeld';
import {
  STANDARD_AUSRICHTUNG,
  schlageFeldVor,
  VORSCHLAG_IDS,
  type Ausrichtung,
} from '../taktik/feldVorschlag';
import type { Pt } from '../taktik/homographie';

interface Paar extends PunktPaar {
  punktId: string;
  /** automatisch vorgeschlagen und noch nicht vom Nutzer bestätigt/verschoben */
  vorschlag?: boolean;
}

const ANALYSE_BREITE = 480;
const GREIF_RADIUS = 0.025; // Anteil der Bildbreite

/** Dialog: im Standbild mindestens 4 Feldpunkte anklicken → Homographie, Qualität und Kontrolllinien. */
export function KalibrierDialog() {
  const offen = useTaktik((x) => x.kalibrierungOffen);
  const projekt = useProjekt((x) => x.projekt);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bild, setBild] = useState<StandbildInfo | null>(null);
  const [paare, setPaare] = useState<Paar[]>([]);
  const [aktuell, setAktuell] = useState<string>('bully-ol');
  const [name, setName] = useState('');
  const [ausrichtung, setAusrichtung] = useState<Ausrichtung>(STANDARD_AUSRICHTUNG);
  const [vorschlagStatus, setVorschlagStatus] = useState<'' | 'nichtGefunden' | 'saat'>('');
  const saatRef = useRef<Pt | undefined>(undefined);
  const zieheRef = useRef<string | null>(null);
  const feld = projekt?.taktik.feld;
  const punkte = useMemo(() => (feld ? referenzPunkte(feld) : []), [feld]);

  useEffect(() => {
    if (!offen) return;
    const b = aktuellesBild();
    setBild(b);
    setPaare([]);
    setAktuell('bully-ol');
    setAusrichtung(STANDARD_AUSRICHTUNG);
    setVorschlagStatus('');
    saatRef.current = undefined;
    const q = projekt?.quellen.find((x) => x.id === b?.quelleId);
    setName(b && q ? `${q.dateiname} – ${formatZeit(b.quellZeit, q.fps)}` : 'Kamera');
  }, [offen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bestätigte Punkte haben Vorrang; erst wenn es davon weniger als 4 gibt, zählen auch Vorschläge mit.
  const basis = useMemo(() => {
    const fest = paare.filter((p) => !p.vorschlag);
    return fest.length >= 4 ? fest : paare;
  }, [paare]);
  const nurVorschlag = basis.some((p) => p.vorschlag);
  const ergebnis = useMemo(() => (basis.length >= 4 ? berechneKalibrierung(basis) : null), [basis]);

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
      ctx.strokeStyle = p.vorschlag ? '#FB8C00' : '#E53935';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
      if (p.vorschlag) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(String(i + 1), x + 8, y - 8);
    });
  }, [bild, paare, ergebnis, feld]);

  if (!offen || !projekt || !feld) return null;
  const schliesse = () => useTaktik.getState().setze({ kalibrierungOffen: false });
  const naechster = (benutzt: Set<string>) => punkte.find((p) => !benutzt.has(p.id))?.id ?? aktuell;
  const plaus = ergebnis ? pruefePlausibilitaet(ergebnis.H, feld.laenge, feld.breite) : null;
  const guete = ergebnis
    ? bewerteKalibrierung(ergebnis, Math.hypot(feld.laenge, feld.breite))
    : null;

  const posImBild = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  /** Vorschlag berechnen; bestätigte Punkte bleiben, übrige Punkte werden ersetzt. */
  const schlageVor = (a: Ausrichtung, saat?: Pt) => {
    if (!bild || !feld) return;
    const B = ANALYSE_BREITE;
    const H = Math.round((B * bild.frame.height) / bild.frame.width);
    const c = document.createElement('canvas');
    c.width = B;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bild.frame, 0, 0, B, H);
    const img = ctx.getImageData(0, 0, B, H);
    const s = saat ?? saatRef.current;
    const v = schlageFeldVor(img, feld, a, s ? { x: s.x * B, y: s.y * H } : undefined);
    if (!v) {
      setVorschlagStatus(s ? 'nichtGefunden' : 'saat');
      return;
    }
    setVorschlagStatus('');
    const ids = new Set(VORSCHLAG_IDS);
    setPaare((alt) => {
      const fest = alt.filter((p) => !p.vorschlag);
      const festIds = new Set(fest.map((p) => p.punktId));
      const neu: Paar[] = v.punkte
        .filter((p) => ids.has(p.id) && !festIds.has(p.id))
        .map((p) => ({ punktId: p.id, bild: p.bild, feld: { x: p.x, y: p.y }, vorschlag: true }));
      return [...fest, ...neu];
    });
  };

  const aendereAusrichtung = (teil: Partial<Ausrichtung>) => {
    const a = { ...ausrichtung, ...teil };
    setAusrichtung(a);
    if (paare.some((p) => p.vorschlag)) schlageVor(a);
  };

  const zeigerUnten = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = posImBild(e);
    const r = e.currentTarget.getBoundingClientRect();
    const asp = r.height / r.width;
    // Vorhandenen Punkt anfassen und ziehen (Korrektur des Vorschlags)
    let nah: Paar | null = null;
    let d0 = GREIF_RADIUS;
    for (const p of paare) {
      const d = Math.hypot(p.bild.x - pos.x, (p.bild.y - pos.y) * asp);
      if (d < d0) {
        d0 = d;
        nah = p;
      }
    }
    if (nah) {
      zieheRef.current = nah.punktId;
      e.currentTarget.setPointerCapture(e.pointerId);
      setAktuell(nah.punktId);
      return;
    }
    if (vorschlagStatus && !saatRef.current) {
      saatRef.current = pos;
      schlageVor(ausrichtung, pos);
      return;
    }
    const ref = punkte.find((p) => p.id === aktuell);
    if (!ref) return;
    const neu = [
      ...paare.filter((p) => p.punktId !== ref.id),
      { punktId: ref.id, bild: pos, feld: { x: ref.x, y: ref.y } },
    ];
    setPaare(neu);
    setAktuell(naechster(new Set(neu.map((p) => p.punktId))));
  };

  const zeigerBewegt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const id = zieheRef.current;
    if (!id) return;
    const pos = posImBild(e);
    const x = Math.min(1, Math.max(0, pos.x));
    const y = Math.min(1, Math.max(0, pos.y));
    setPaare((alt) =>
      alt.map((p) => (p.punktId === id ? { ...p, bild: { x, y }, vorschlag: false } : p)),
    );
  };

  const zeigerOben = () => {
    zieheRef.current = null;
  };

  const speichern = () => {
    if (!ergebnis || !bild) return;
    const k: Kalibrierung = {
      id: neueId(),
      name: name.trim() || 'Kalibrierung',
      quelleId: bild.quelleId,
      zeit: bild.quellZeit,
      paare: basis.map((p) => ({ punktId: p.punktId, bild: p.bild, feld: p.feld })),
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
                style={{
                  width: '100%',
                  cursor: 'crosshair',
                  border: '1px solid var(--bd-rule)',
                  touchAction: 'none',
                }}
                onPointerDown={zeigerUnten}
                onPointerMove={zeigerBewegt}
                onPointerUp={zeigerOben}
                onPointerCancel={zeigerOben}
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
              <div style={{ marginTop: 8 }}>
                <button
                  className="primaer"
                  data-testid="punkte-vorschlagen"
                  onClick={() => schlageVor(ausrichtung)}
                >
                  {t.taktik.vorschlagen}
                </button>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    aria-pressed={ausrichtung.tauscheX}
                    data-testid="tausche-x"
                    onClick={() => aendereAusrichtung({ tauscheX: !ausrichtung.tauscheX })}
                  >
                    {t.taktik.tauscheX}
                  </button>
                  <button
                    aria-pressed={ausrichtung.tauscheY}
                    data-testid="tausche-y"
                    onClick={() => aendereAusrichtung({ tauscheY: !ausrichtung.tauscheY })}
                  >
                    {t.taktik.tauscheY}
                  </button>
                  <button
                    aria-pressed={ausrichtung.quer}
                    data-testid="quer"
                    onClick={() => aendereAusrichtung({ quer: !ausrichtung.quer })}
                  >
                    {t.taktik.quer}
                  </button>
                </div>
                {vorschlagStatus && (
                  <p role="status" className="hinweis" data-testid="vorschlag-status">
                    {vorschlagStatus === 'saat' ? t.taktik.vorschlagSaat : t.taktik.vorschlagNichts}
                  </p>
                )}
                {nurVorschlag && paare.length > 0 && (
                  <p className="hinweis" data-testid="vorschlag-hinweis">
                    {t.taktik.vorschlagHinweis}
                  </p>
                )}
              </div>
              <p className="kicker" style={{ marginTop: 8 }}>
                {t.taktik.punkte} ({basis.length}/4+)
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
                        {gesetzt ? (gesetzt.vorschlag ? '≈ ' : '✓ ') : ''}
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
                {basis.length < 4 && (
                  <span className="hinweis">{t.taktik.nochPunkte(4 - basis.length)}</span>
                )}
                {basis.length >= 4 && !ergebnis && (
                  <span style={{ color: '#E53935' }}>{t.taktik.entartet}</span>
                )}
                {plaus && !plaus.ok && (
                  <p role="alert" data-testid="kalibrier-warnung" style={{ color: '#E53935' }}>
                    {t.taktik.kalibrierWarnungText(t.taktik.kalibrierWarnungen[plaus.grund])}
                  </p>
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
