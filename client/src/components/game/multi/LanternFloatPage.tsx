import { LanternFloat } from "./LanternFloat";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function LanternFloatPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <LanternFloat
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
