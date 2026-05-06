import { TodayFeel } from "./TodayFeel";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TodayFeelPage(props: Props) {
  return <TodayFeel {...props} />;
}

export default TodayFeelPage;
