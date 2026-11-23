import { TeamEditor } from './TeamEditor';
import { TagDefEditor } from './TagDefEditor';
import { OverlayEinstellungen } from './OverlayEinstellungen';
import { useProjekt } from '../store/projektStore';

export function SetupPanel() {
  const projekt = useProjekt((x) => x.projekt);
  if (!projekt) return null;
  return (
    <>
      <OverlayEinstellungen />
      <div style={{ height: 24 }} />
      <TeamEditor index={0} />
      <TeamEditor index={1} />
      <TagDefEditor />
    </>
  );
}
