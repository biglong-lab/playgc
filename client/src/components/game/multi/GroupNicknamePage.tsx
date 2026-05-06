import { GroupNickname } from "./GroupNickname";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function GroupNicknamePage(props: Props) {
  return <GroupNickname {...props} />;
}
