import { SnowGlobe } from "./SnowGlobe";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function SnowGlobePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <SnowGlobe
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
