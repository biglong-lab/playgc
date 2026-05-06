import { BlindSpot } from "./BlindSpot";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function BlindSpotPage(props: Props) {
  return <BlindSpot {...props} />;
}

export default BlindSpotPage;
