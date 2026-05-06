import { LifeLine } from "./LifeLine";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LifeLinePage(props: Props) {
  return <LifeLine {...props} />;
}

export default LifeLinePage;
