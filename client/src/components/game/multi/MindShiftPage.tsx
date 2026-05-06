import { MindShift } from "./MindShift";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function MindShiftPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <MindShift
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
