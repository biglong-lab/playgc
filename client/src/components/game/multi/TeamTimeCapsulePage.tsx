import { TeamTimeCapsule } from "./TeamTimeCapsule";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamTimeCapsulePage(props: Props) {
  return <TeamTimeCapsule {...props} />;
}

export default TeamTimeCapsulePage;
