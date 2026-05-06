import { FireworkBurst } from "./FireworkBurst";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function FireworkBurstPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <FireworkBurst
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
