import { ChildhoodGame } from "./ChildhoodGame";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ChildhoodGamePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ChildhoodGame
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
