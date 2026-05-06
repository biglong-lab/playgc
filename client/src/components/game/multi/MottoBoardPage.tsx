import { MottoBoard } from "./MottoBoard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MottoBoardPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <MottoBoard
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
