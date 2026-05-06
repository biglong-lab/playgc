import { NightSky } from "./NightSky";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function NightSkyPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <NightSky
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
