import { SpeedFact } from "./SpeedFact";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SpeedFactPage(props: Props) {
  return <SpeedFact {...props} />;
}

export default SpeedFactPage;
