import { GrowthEdge } from "./GrowthEdge";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function GrowthEdgePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <GrowthEdge
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
