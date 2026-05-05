import { QuickReaction } from "./QuickReaction";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function QuickReactionPage(props: Props) {
  return <QuickReaction {...props} />;
}
