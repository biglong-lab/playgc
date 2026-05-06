import { TeamRadar } from "./TeamRadar";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamRadarPage(props: Props) {
  return <TeamRadar {...props} />;
}

export default TeamRadarPage;
