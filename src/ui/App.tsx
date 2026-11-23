import { useEffect, useState } from 'react';
import { Startseite } from './Startseite';
import { Editor } from './Editor';
import { FeatureDialog } from './FeatureDialog';
import { Benchmark } from './Benchmark';

/** Hash-Routing (#/ und #/p/<id>) – funktioniert auf GitHub Pages ohne Server-Konfiguration. */
function leseRoute(): string | null {
  const m = /^#\/p\/(.+)$/.exec(window.location.hash);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function App() {
  const [projektId, setProjektId] = useState<string | null>(leseRoute());
  const [, neu] = useState(0);
  useEffect(() => {
    const f = () => {
      setProjektId(leseRoute());
      neu((n) => n + 1);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  if (window.location.hash === '#/benchmark') return <Benchmark />;
  return (
    <>
      {projektId ? <Editor key={projektId} projektId={projektId} /> : <Startseite />}
      <FeatureDialog />
    </>
  );
}
