import { MapleDrift } from "./MapleDrift";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function MapleDriftPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <MapleDrift
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
