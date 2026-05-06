import { SuperpowerCard } from "./SuperpowerCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SuperpowerCardPage(props: Props) {
  return <SuperpowerCard {...props} />;
}

export default SuperpowerCardPage;
