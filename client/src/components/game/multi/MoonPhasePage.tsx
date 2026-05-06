import { MoonPhase } from "./MoonPhase";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function MoonPhasePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <MoonPhase
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
