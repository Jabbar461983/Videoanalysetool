import { useEffect, useState } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { t } from '../i18n/de-CH';
import { dateiKey } from '../db/projekte';
import { useProgramm } from '../store/programm';
import { useProjekt } from '../store/projektStore';
import { Buehne } from '../ui/Buehne';
import { ClipListe } from '../ui/ClipListe';
import { ExportPanel } from '../ui/ExportPanel';
import { PlaylistPanel } from '../ui/PlaylistPanel';
import { ProgrammTimeline } from '../ui/ProgrammTimeline';
import { QuellenBanner } from '../ui/QuellenBanner';
import { Quellenpanel } from '../ui/Quellenpanel';
import { SetupPanel } from '../ui/SetupPanel';
import { TagLeiste } from '../ui/TagLeiste';
import { TagListe } from '../ui/TagListe';
import { TaktikPanel } from '../ui/TaktikPanel';
import { Timeline } from '../ui/Timeline';
import s from './layout.module.css';

function useAktiveQuelle() {
  const projekt = useProjekt((x) => x.projekt);
  return projekt?.quellen.find((x) => x.id === projekt.aktiveQuelleId) ?? projekt?.quellen[0];
}

function BuehnePanel() {
  const q = useAktiveQuelle();
  const praesi = false;
  return (
    <div className={s.buehne}>
      {!praesi && <QuellenBanner />}
      <Buehne quelle={q} />
    </div>
  );
}

function TagLeistePanel() {
  const art = useProgramm((g) => g.art);
  return (
    <div className={s.tagleiste}>
      {art === 'quelle' ? <TagLeiste /> : <p className="hinweis">{t.layout.tagleisteHinweis}</p>}
    </div>
  );
}

function ZeitPanel() {
  const q = useAktiveQuelle();
  const art = useProgramm((g) => g.art);
  return (
    <div className={s.zeit}>
      {art === 'quelle' ? (
        <Timeline quelle={q} schluessel={q ? dateiKey(q) : ''} />
      ) : (
        <ProgrammTimeline />
      )}
    </div>
  );
}

const seite = (Inhalt: () => React.ReactNode, name: string) => {
  const C = (_p: IDockviewPanelProps) => (
    <div className={s.seite} data-modul={name}>
      <Inhalt />
    </div>
  );
  C.displayName = `Seite_${name}`;
  return C;
};

export const KOMPONENTEN: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  buehne: BuehnePanel,
  taglesite: TagLeistePanel,
  zeit: ZeitPanel,
  quellen: seite(Quellenpanel, 'quellen'),
  tags: seite(TagListe, 'tags'),
  clips: seite(ClipListe, 'clips'),
  playlist: seite(PlaylistPanel, 'playlist'),
  taktik: seite(TaktikPanel, 'taktik'),
  setup: seite(SetupPanel, 'setup'),
  export: seite(ExportPanel, 'export'),
};

/** Register-Kopf (Rolle `tab` und `aria-selected` liefert Dockview selbst). */
export function ModulTab(props: IDockviewPanelHeaderProps) {
  const { api } = props;
  const [aktiv, setAktiv] = useState(api.isActive);
  const [titel, setTitel] = useState(api.title);
  useEffect(() => {
    const a = api.onDidActiveChange((e) => setAktiv(e.isActive));
    const b = api.onDidTitleChange((e) => setTitel(e.title));
    return () => {
      a.dispose();
      b.dispose();
    };
  }, [api]);
  return (
    <div className={s.tab} data-aktiv={aktiv}>
      {titel}
    </div>
  );
}
