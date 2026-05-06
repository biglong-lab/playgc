import { WeddingVow } from "./WeddingVow";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function WeddingVowPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <WeddingVow
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
