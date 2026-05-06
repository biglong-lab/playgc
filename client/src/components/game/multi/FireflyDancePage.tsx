import { FireflyDance } from "./FireflyDance";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function FireflyDancePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <FireflyDance
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
