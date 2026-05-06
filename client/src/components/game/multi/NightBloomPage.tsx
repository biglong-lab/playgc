import { NightBloom } from "./NightBloom";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function NightBloomPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <NightBloom
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
