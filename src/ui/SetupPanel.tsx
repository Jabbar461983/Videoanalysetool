import { TeamEditor } from './TeamEditor';
import { TagDefEditor } from './TagDefEditor';
import { OverlayEinstellungen } from './OverlayEinstellungen';
import { useProjekt } from '../store/projektStore';
import { useState } from 'react';
import { leseKiGeraet, setzeKiGeraet, type KiGeraet } from '../ki/geraet';
import { t } from '../i18n/de-CH';
import {
  automatikErzwungen,
  erzwingeAutomatik,
  wiederholeSchnelltest,
} from '../ki/trackingAktionen';

export function SetupPanel() {
  const projekt = useProjekt((x) => x.projekt);
  const [erzwungen, setErzwungen] = useState(automatikErzwungen());
  const [pruefung, setPruefung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [geraet, setGeraet] = useState<KiGeraet>(leseKiGeraet());
  if (!projekt) return null;
  return (
    <>
      <OverlayEinstellungen />
      <div style={{ height: 24 }} />
      <p className="kicker">{t.spieler.titel}</p>
      <label>
        {t.spieler.trackingModus}{' '}
        <select
          value={projekt.einstellungen.trackingModus}
          data-testid="einstellung-tracking"
          onChange={(e) =>
            useProjekt.getState().aendere('Tracking-Modus', (p) => {
              p.einstellungen.trackingModus = e.target.value as 'auto' | 'freeze';
            })
          }
        >
          <option value="auto">{t.spieler.modusAuto}</option>
          <option value="freeze">{t.spieler.modusFreeze}</option>
        </select>
      </label>
      <p className="hinweis">{t.spieler.freeze}</p>
      <label>
        {t.spieler.kiGeraet}{' '}
        <select
          value={geraet}
          data-testid="ki-geraet"
          onChange={(e) => {
            setzeKiGeraet(e.target.value as KiGeraet);
            setGeraet(e.target.value as KiGeraet);
          }}
        >
          <option value="auto">{t.spieler.geraetAuto}</option>
          <option value="wasm">{t.spieler.geraetCpu}</option>
        </select>
      </label>
      <p className="hinweis">{t.spieler.geraetHinweis}</p>
      <p>
        <button
          type="button"
          disabled={laeuft}
          data-testid="schnelltest-wiederholen"
          onClick={() => {
            setLaeuft(true);
            setPruefung(t.spieler.trackingPruefung);
            wiederholeSchnelltest()
              .then((r) => setPruefung(`${r.ok ? 'Bestanden. ' : 'Nicht bestanden. '}${r.info}`))
              .catch((e) =>
                setPruefung(`Fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`),
              )
              .finally(() => setLaeuft(false));
          }}
        >
          {t.spieler.schnelltest}
        </button>
      </p>
      {pruefung && (
        <p className="hinweis" role="status" data-testid="schnelltest-ergebnis">
          {pruefung}
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={erzwungen}
          data-testid="automatik-erzwingen"
          onChange={(e) => {
            erzwingeAutomatik(e.target.checked);
            setErzwungen(e.target.checked);
          }}
        />{' '}
        {t.spieler.automatikErzwingen}
      </label>
      <div style={{ height: 24 }} />
      <TeamEditor index={0} />
      <TeamEditor index={1} />
      <TagDefEditor />
    </>
  );
}
