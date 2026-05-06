import { ResilienceCard } from "./ResilienceCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function ResilienceCardPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <ResilienceCard
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
