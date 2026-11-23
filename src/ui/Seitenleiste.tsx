import { useState } from 'react';
import { t } from '../i18n/de-CH';
import { Quellenpanel } from './Quellenpanel';
import { TagListe } from './TagListe';
import { ClipListe } from './ClipListe';
import { SetupPanel } from './SetupPanel';
import s from './Seitenleiste.module.css';

const TABS = [
  ['quellen', t.seite.quellen],
  ['tags', t.seite.tags],
  ['clips', t.seite.clips],
  ['setup', t.seite.setup],
] as const;
type Tab = (typeof TABS)[number][0];

export function Seitenleiste() {
  const [tab, setTab] = useState<Tab>('quellen');
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
      {tab === 'setup' && <SetupPanel />}
    </>
  );
}
