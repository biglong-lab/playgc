import { SpeedBrainstorm } from "./SpeedBrainstorm";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SpeedBrainstormPage(props: Props) {
  return <SpeedBrainstorm {...props} />;
}

export default SpeedBrainstormPage;
