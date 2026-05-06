import { InkBrush } from "./InkBrush";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function InkBrushPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <InkBrush
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
