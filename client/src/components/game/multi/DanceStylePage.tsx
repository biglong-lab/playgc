import { DanceStyle } from "./DanceStyle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function DanceStylePage(props: Props) {
  return <DanceStyle {...props} />;
}
