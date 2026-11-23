import { t } from '../i18n/de-CH';
import { Quellenpanel } from './Quellenpanel';
import { TagListe } from './TagListe';
import { ClipListe } from './ClipListe';
import { SetupPanel } from './SetupPanel';
import { PlaylistPanel } from './PlaylistPanel';
import { ExportPanel } from './ExportPanel';
import { useUi, type SeitenTab } from '../store/ui';
import s from './Seitenleiste.module.css';

const TABS = [
  ['quellen', t.seite.quellen],
  ['tags', t.seite.tags],
  ['clips', t.seite.clips],
  ['playlist', t.seite.playlist],
  ['setup', t.seite.setup],
  ['export', t.seite.export],
] as const;

export function Seitenleiste() {
  const tab = useUi((u) => u.tab);
  const setTab = (id: SeitenTab) => useUi.getState().setzeTab(id);
  return (
    <>
      <div role="tablist" className={s.tabs}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            className={s.tab}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'quellen' && <Quellenpanel />}
      {tab === 'tags' && <TagListe />}
      {tab === 'clips' && <ClipListe />}
      {tab === 'playlist' && <PlaylistPanel />}
      {tab === 'setup' && <SetupPanel />}
      {tab === 'export' && <ExportPanel />}
    </>
  );
}
