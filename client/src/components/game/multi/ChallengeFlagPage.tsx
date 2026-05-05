import { ChallengeFlag } from "./ChallengeFlag";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ChallengeFlagPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ChallengeFlag
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
