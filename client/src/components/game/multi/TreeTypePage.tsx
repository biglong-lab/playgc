import { TreeType } from "./TreeType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function TreeTypePage(props: Props) {
  return <TreeType {...props} />;
}
