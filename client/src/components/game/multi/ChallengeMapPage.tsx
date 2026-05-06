import { ChallengeMap } from "./ChallengeMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ChallengeMapPage(props: Props) {
  return <ChallengeMap {...props} />;
}

export default ChallengeMapPage;
