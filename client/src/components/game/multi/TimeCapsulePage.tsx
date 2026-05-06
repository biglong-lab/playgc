import { TimeCapsule } from "./TimeCapsule";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TimeCapsulePage(props: Props) {
  return <TimeCapsule {...props} />;
}

export default TimeCapsulePage;
