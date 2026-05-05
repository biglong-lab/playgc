import { TeamGoal } from "./TeamGoal";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function TeamGoalPage(props: Props) {
  return <TeamGoal {...props} />;
}
