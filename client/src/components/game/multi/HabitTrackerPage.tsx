import { HabitTracker } from "./HabitTracker";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HabitTrackerPage(props: Props) {
  return <HabitTracker {...props} />;
}

export default HabitTrackerPage;
