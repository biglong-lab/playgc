import { HopeFear } from "./HopeFear";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HopeFearPage(props: Props) {
  return <HopeFear {...props} />;
}

export default HopeFearPage;
