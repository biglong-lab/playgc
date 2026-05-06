import { GlassBottle } from "./GlassBottle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function GlassBottlePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <GlassBottle
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
