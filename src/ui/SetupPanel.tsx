import { TeamEditor } from './TeamEditor';
import { TagDefEditor } from './TagDefEditor';
import { OverlayEinstellungen } from './OverlayEinstellungen';
import { useProjekt } from '../store/projektStore';
import { t } from '../i18n/de-CH';

export function SetupPanel() {
  const projekt = useProjekt((x) => x.projekt);
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
      <div style={{ height: 24 }} />
      <TeamEditor index={0} />
      <TeamEditor index={1} />
      <TagDefEditor />
    </>
  );
}
