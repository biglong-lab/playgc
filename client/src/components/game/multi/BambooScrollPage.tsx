import { BambooScroll } from "./BambooScroll";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function BambooScrollPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <BambooScroll
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
