import { TeamFlag } from "./TeamFlag";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function TeamFlagPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <TeamFlag
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
