import { CountdownPledge } from "./CountdownPledge";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CountdownPledgePage(props: Props) {
  return <CountdownPledge {...props} />;
}

export default CountdownPledgePage;
