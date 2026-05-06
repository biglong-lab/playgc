import { RocketLaunch } from "./RocketLaunch";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function RocketLaunchPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <RocketLaunch
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
