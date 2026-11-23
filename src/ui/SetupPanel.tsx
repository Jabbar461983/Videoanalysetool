import { TeamEditor } from './TeamEditor';
import { TagDefEditor } from './TagDefEditor';
import { useProjekt } from '../store/projektStore';

export function SetupPanel() {
  const projekt = useProjekt((x) => x.projekt);
  if (!projekt) return null;
  return (
    <>
      <TeamEditor index={0} />
      <TeamEditor index={1} />
      <TagDefEditor />
    </>
  );
}
