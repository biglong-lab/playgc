import { BoardGame } from "./BoardGame";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function BoardGamePage(props: Props) {
  return <BoardGame {...props} />;
}
