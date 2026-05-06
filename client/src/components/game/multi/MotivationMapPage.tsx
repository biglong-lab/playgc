import { MotivationMap } from "./MotivationMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MotivationMapPage(props: Props) {
  return <MotivationMap {...props} />;
}

export default MotivationMapPage;
