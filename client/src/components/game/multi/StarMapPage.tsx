import { StarMap } from "./StarMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StarMapPage(props: Props) {
  return <StarMap {...props} />;
}

export default StarMapPage;
