import { LifeTree } from "./LifeTree";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function LifeTreePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <LifeTree
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
