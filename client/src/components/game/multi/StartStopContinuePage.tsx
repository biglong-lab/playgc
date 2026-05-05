import { StartStopContinue } from "./StartStopContinue";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function StartStopContinuePage(props: Props) {
  return <StartStopContinue {...props} />;
}
