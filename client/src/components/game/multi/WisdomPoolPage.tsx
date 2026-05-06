import { WisdomPool } from "./WisdomPool";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WisdomPoolPage(props: Props) {
  return <WisdomPool {...props} />;
}

export default WisdomPoolPage;
