import { KoiPond } from "./KoiPond";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function KoiPondPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <KoiPond
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
