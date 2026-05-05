import { ThoughtBubble } from "./ThoughtBubble";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ThoughtBubblePage(props: Props) {
  return <ThoughtBubble {...props} />;
}

export default ThoughtBubblePage;
