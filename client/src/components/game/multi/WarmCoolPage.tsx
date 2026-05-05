import { WarmCool } from "./WarmCool";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WarmCoolPage(props: Props) {
  return <WarmCool {...props} />;
}

export default WarmCoolPage;
