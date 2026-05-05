import { TeamVision } from "./TeamVision";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamVisionPage(props: Props) {
  return <TeamVision {...props} />;
}

export default TeamVisionPage;
