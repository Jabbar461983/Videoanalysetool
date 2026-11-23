import { useState } from 'react';
import { t } from '../i18n/de-CH';
import { dateiKey } from '../db/projekte';
import { formatBytes } from '../db/speicher';
import { useDateien } from '../store/dateien';
import { useProjekt } from '../store/projektStore';
import { erzeugeQuelle, pruefeDatei } from '../video/quelle';
import { handleAusDrop, speichereHandle, waehleVideos } from '../video/handles';
import { formatZeit } from '../video/bildmathe';
import type { Quelle } from '../model/typen';
import { ProxyDialog } from './ProxyDialog';

type Eintrag = { datei: File; handle?: FileSystemFileHandle };

export function Quellenpanel() {
  const projekt = useProjekt((x) => x.projekt);
  const dateien = useDateien((d) => d.dateien);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ueber, setUeber] = useState(false);
  const [proxyFuer, setProxyFuer] = useState<Quelle | null>(null);
  if (!projekt) return null;

  const fuegeHinzu = async (eintraege: Eintrag[]) => {
    setMeldung(null);
    setBeschaeftigt(true);
    try {
      for (const { datei, handle } of eintraege) {
        try {
          const { quelle, abspielbarWebCodecs } = await erzeugeQuelle(datei);
          const vorhanden = useProjekt
            .getState()
            .projekt?.quellen.find((q) => dateiKey(q) === dateiKey(quelle));
          const q = vorhanden ?? quelle;
          if (!vorhanden) {
            useProjekt.getState().aendere('Quelle hinzufügen', (p) => {
              p.quellen.push(quelle);
              p.aktiveQuelleId ??= quelle.id;
            });
          }
          useDateien.getState().setze(q.id, datei);
          if (handle) await speichereHandle(dateiKey(q), handle);
          if (!abspielbarWebCodecs) setMeldung(t.player.nichtAbspielbar);
        } catch (e) {
          setMeldung(
            (e as Error).message === 'KEIN_VIDEO' ? t.import.keinVideo : t.import.fehlerMeta,
          );
        }
      }
    } finally {
      setBeschaeftigt(false);
    }
  };

  const auswaehlen = async () => {
    await fuegeHinzu(await waehleVideos(true));
  };

  const neuVerknuepfen = async (q: Quelle) => {
    // Zuerst gespeicherten Handle mit Nutzergeste erneut versuchen
    if (await useDateien.getState().versuche(q, true)) return;
    const [auswahl] = await waehleVideos(false);
    if (!auswahl) return;
    const treffer = await pruefeDatei(q, auswahl.datei);
    if (treffer === 'anders' && !window.confirm(t.import.andereDatei)) return;
    useDateien.getState().setze(q.id, auswahl.datei);
    if (auswahl.handle) await speichereHandle(dateiKey(q), auswahl.handle);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setUeber(false);
    const items = [...e.dataTransfer.items].filter((i) => i.kind === 'file');
    const eintraege: Eintrag[] = [];
    // Handles müssen synchron angefordert werden, bevor die Items verfallen
    const handles = items.map((i) => handleAusDrop(i));
    const files = [...e.dataTransfer.files];
    const hs = await Promise.all(handles);
    files.forEach((datei, i) => eintraege.push({ datei, handle: hs[i] }));
    await fuegeHinzu(eintraege);
  };

  const entfernen = (id: string) => {
    useProjekt.getState().aendere('Quelle entfernen', (p) => {
      p.quellen = p.quellen.filter((q) => q.id !== id);
      if (p.aktiveQuelleId === id) p.aktiveQuelleId = p.quellen[0]?.id;
    });
    useDateien.getState().entferne(id);
  };

  return (
    <section aria-label={t.import.quellen}>
      <p className="kicker">{t.import.quellen}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setUeber(true);
        }}
        onDragLeave={() => setUeber(false)}
        onDrop={(e) => void onDrop(e)}
        data-testid="dropzone"
        style={{
          border: `1px dashed ${ueber ? 'var(--bd-gold)' : 'var(--bd-rule)'}`,
          padding: 12,
          textAlign: 'center',
          margin: '8px 0',
        }}
      >
        <p className="hinweis" style={{ margin: '0 0 8px' }}>
          {t.import.ablegen}
        </p>
        <button className="primaer" onClick={() => void auswaehlen()} disabled={beschaeftigt}>
          {projekt.quellen.length ? t.import.mehrere : t.import.auswaehlen}
        </button>
        <input
          type="file"
          accept="video/*,.mkv,.mov"
          multiple
          hidden
          data-testid="datei-input"
          onChange={(e) => {
            void fuegeHinzu([...(e.target.files ?? [])].map((datei) => ({ datei })));
            e.target.value = '';
          }}
        />
      </div>
      {beschaeftigt && (
        <p className="hinweis" role="status">
          {t.import.liest}
        </p>
      )}
      {meldung && (
        <p role="alert" style={{ color: 'var(--bd-gold)' }}>
          {meldung}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {projekt.quellen.map((q) => {
          const da = !!dateien[q.id];
          const aktiv = (projekt.aktiveQuelleId ?? projekt.quellen[0]?.id) === q.id;
          return (
            <li
              key={q.id}
              style={{
                borderTop: '1px solid var(--bd-rule)',
                padding: '8px 0',
                borderLeft: aktiv ? '3px solid var(--bd-gold)' : '3px solid transparent',
                paddingLeft: 8,
              }}
            >
              <strong style={{ color: 'var(--bd-ink)', wordBreak: 'break-all' }}>
                {q.dateiname}
              </strong>
              <div className="hinweis">
                {formatZeit(q.dauer, q.fps)} · {q.breite}×{q.hoehe} ·{' '}
                {Math.round(q.fps * 100) / 100} {t.meta.fps} · {q.codec} · {formatBytes(q.groesse)}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {!aktiv && (
                  <button
                    onClick={() =>
                      useProjekt.getState().aendereStill((p) => {
                        p.aktiveQuelleId = q.id;
                      })
                    }
                  >
                    {t.import.aktiv}
                  </button>
                )}
                {!da && (
                  <button className="primaer" onClick={() => void neuVerknuepfen(q)}>
                    {t.import.neuVerknuepfen}
                  </button>
                )}
                {da && !q.proxyId && (
                  <button onClick={() => setProxyFuer(q)}>{t.proxy.titel}</button>
                )}
                <button className="gefahr" onClick={() => entfernen(q.id)}>
                  {t.import.entfernen}
                </button>
              </div>
              <span className="hinweis">{da ? t.import.verknuepft : t.import.fehlt}</span>
            </li>
          );
        })}
      </ul>
      {proxyFuer && <ProxyDialog quelle={proxyFuer} onZu={() => setProxyFuer(null)} />}
    </section>
  );
}
