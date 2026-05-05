import { GroupNorm } from "./GroupNorm";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GroupNormPage(props: Props) {
  return <GroupNorm {...props} />;
}

export default GroupNormPage;
