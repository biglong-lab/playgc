import { ConflictStyle } from "./ConflictStyle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ConflictStylePage(props: Props) {
  return <ConflictStyle {...props} />;
}

export default ConflictStylePage;
