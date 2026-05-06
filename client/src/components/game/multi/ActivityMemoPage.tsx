import { ActivityMemo } from "./ActivityMemo";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ActivityMemoPage(props: Props) {
  return <ActivityMemo {...props} />;
}
