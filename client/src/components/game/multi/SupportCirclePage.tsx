import { SupportCircle } from "./SupportCircle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function SupportCirclePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <SupportCircle
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
