import { StressSignal } from "./StressSignal";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StressSignalPage(props: Props) {
  return <StressSignal {...props} />;
}

export default StressSignalPage;
