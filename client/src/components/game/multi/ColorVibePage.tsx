import { ColorVibe } from "./ColorVibe";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ColorVibePage(props: Props) {
  return <ColorVibe {...props} />;
}

export default ColorVibePage;
