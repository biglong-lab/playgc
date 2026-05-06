import { AbilityBadge } from "./AbilityBadge";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function AbilityBadgePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <AbilityBadge
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
