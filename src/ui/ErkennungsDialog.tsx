import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/de-CH';
import { useProjekt } from '../store/projektStore';
import { useTaktik } from '../store/taktik';
import { zeichneFeldAufBild } from '../taktik/bildFeld';
import {
  MAX_SPIELER,
  naechsterZustand,
  tauscheTeams,
  zaehle,
  type Person,
} from '../taktik/pruefung';
import { bestaetigeErkennung } from '../taktik/uebernehmenAktion';

/**
 * Prüfdialog nach «Alle Spieler erkennen»: Das Standbild zeigt alle erkannten Personen als Rahmen und das
 * berechnete Feld. Klick auf einen Rahmen: Team 1 → Team 2 → nicht übernehmen. So lassen sich Zuschauer,
 * Schiedsrichter und Doppelte vor der Übernahme aussortieren.
 */
export function ErkennungsDialog() {
  const e = useTaktik((x) => x.erkennung);
  const projekt = useProjekt((x) => x.projekt);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [personen, setPersonen] = useState<Person[]>([]);

  useEffect(() => {
    setPersonen(e?.personen ?? []);
  }, [e]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !e || !projekt) return;
    const B = 1100;
    const H = Math.round((B * e.frame.height) / e.frame.width);
    c.width = B;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(e.frame, 0, 0, B, H);
    zeichneFeldAufBild(ctx, e.H, projekt.taktik.feld, B, H);
    const f = B / e.frame.width;
    personen.forEach((p, i) => {
      const x = (p.box.cx - p.box.b / 2) * f;
      const y = (p.box.cy - p.box.h / 2) * f;
      const w = p.box.b * f;
      const h = p.box.h * f;
      const farbe = p.an ? (projekt.teams[p.team]?.farbe ?? '#ffffff') : '#9a9a9a';
      ctx.lineWidth = p.an ? 3 : 1.5;
      ctx.strokeStyle = p.an ? '#ffffff' : farbe;
      ctx.setLineDash(p.an ? [] : [4, 3]);
      ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = farbe;
      ctx.strokeRect(x, y, w, h);
      if (p.an) {
        ctx.fillStyle = farbe;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = p.an ? '#ffffff' : '#cfcfcf';
      ctx.fillText(String(i + 1), x + 2, y - 4);
    });
  }, [e, personen, projekt]);

  if (!e || !projekt) return null;
  const z = zaehle(personen);
  const gesamt = z.team1 + z.team2;
  const warnung =
    gesamt > MAX_SPIELER
      ? t.taktik.zuViele(gesamt, MAX_SPIELER)
      : z.team1 > 6 || z.team2 > 6
        ? t.taktik.zuVieleTeam
        : '';
  const schliesse = () => useTaktik.getState().setze({ erkennung: null });

  const klick = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const f = ev.currentTarget.width / e.frame.width;
    const px = ((ev.clientX - r.left) / r.width) * ev.currentTarget.width;
    const py = ((ev.clientY - r.top) / r.height) * ev.currentTarget.height;
    // kleinste Box unter dem Zeiger (bei Überlappung die vordere Person)
    let best = -1;
    let bestFlaeche = Infinity;
    personen.forEach((p, i) => {
      const x0 = (p.box.cx - p.box.b / 2) * f;
      const y0 = (p.box.cy - p.box.h / 2) * f;
      const w = p.box.b * f;
      const h = p.box.h * f;
      if (
        px >= x0 - 3 &&
        px <= x0 + w + 3 &&
        py >= y0 - 3 &&
        py <= y0 + h + 3 &&
        w * h < bestFlaeche
      ) {
        best = i;
        bestFlaeche = w * h;
      }
    });
    if (best >= 0) setPersonen(personen.map((p, i) => (i === best ? naechsterZustand(p) : p)));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.taktik.pruefen}
      data-testid="erkennungs-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bd-scrim)',
        zIndex: 86,
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
          <strong className="kicker">{t.taktik.pruefen}</strong>
          <span style={{ flex: 1 }} />
          <button onClick={() => setPersonen(tauscheTeams(personen))} data-testid="pruef-tauschen">
            {t.taktik.teamsTauschen}
          </button>
          <button onClick={schliesse}>{t.taktik.abbrechen}</button>
          <button
            className="primaer"
            data-testid="pruef-uebernehmen"
            disabled={gesamt === 0}
            onClick={() => bestaetigeErkennung(personen)}
          >
            {t.taktik.uebernehmenN(gesamt)}
          </button>
        </div>
        <p className="hinweis" data-testid="pruef-hinweis">
          {e.hinweis}
        </p>
        <canvas
          ref={canvasRef}
          data-testid="pruef-bild"
          style={{ width: '100%', cursor: 'pointer', border: '1px solid var(--bd-rule)' }}
          onPointerDown={klick}
        />
        <p data-testid="pruef-zaehlung" role="status" style={{ marginTop: 8 }}>
          <strong>{projekt.teams[0].kuerzel}</strong>: {z.team1} ·{' '}
          <strong>{projekt.teams[1].kuerzel}</strong>: {z.team2} · {t.taktik.nichtUebernommen}:{' '}
          {z.aus}
          {warnung && <span style={{ color: 'var(--bd-gold)' }}> · {warnung}</span>}
        </p>
        <p className="hinweis">{t.taktik.pruefHilfe}</p>
      </div>
    </div>
  );
}
