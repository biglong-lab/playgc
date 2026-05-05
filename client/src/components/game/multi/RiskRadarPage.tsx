import { RiskRadar } from "./RiskRadar";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function RiskRadarPage(props: Props) {
  return <RiskRadar {...props} />;
}
