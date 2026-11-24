import { useEffect, useState } from 'react';
import { ausgabeWaehlbar } from '../audio/mixer';
import { t } from '../i18n/de-CH';
import { mixer } from '../wiedergabe/transport';

/** Wahl des Tonausgabegeräts (z. B. HDMI-Beamer statt Laptop-Lautsprecher). Nur Chrome/Edge. */
export function AudioAusgabe() {
  const [geraete, setGeraete] = useState<{ id: string; label: string }[]>([]);
  const [gewaehlt, setGewaehlt] = useState('');
  const moeglich = ausgabeWaehlbar();

  useEffect(() => {
    if (!moeglich || !navigator.mediaDevices?.enumerateDevices) return;
    let weg = false;
    const lade = () =>
      void navigator.mediaDevices.enumerateDevices().then((l) => {
        if (weg) return;
        setGeraete(
          l
            .filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default')
            .map((d, i) => ({
              id: d.deviceId,
              label: d.label || t.praesentation.tonGeraet(i + 1),
            })),
        );
      });
    lade();
    navigator.mediaDevices.addEventListener?.('devicechange', lade);
    return () => {
      weg = true;
      navigator.mediaDevices.removeEventListener?.('devicechange', lade);
    };
  }, [moeglich]);

  if (!moeglich || geraete.length === 0) return null;
  return (
    <label className="hinweis" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {t.praesentation.ton}
      <select
        data-testid="audio-ausgabe"
        value={gewaehlt}
        onChange={(e) => {
          setGewaehlt(e.target.value);
          void mixer.setzeAusgabe(e.target.value);
        }}
      >
        <option value="">{t.praesentation.tonStandard}</option>
        {geraete.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
    </label>
  );
}
