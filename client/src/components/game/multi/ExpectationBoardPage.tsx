import { ExpectationBoard } from "./ExpectationBoard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ExpectationBoardPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ExpectationBoard
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
