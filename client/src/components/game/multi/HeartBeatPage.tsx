import { HeartBeat } from "./HeartBeat";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function HeartBeatPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <HeartBeat
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
