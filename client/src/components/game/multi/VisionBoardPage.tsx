import { VisionBoard } from "./VisionBoard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function VisionBoardPage(props: Props) {
  return <VisionBoard {...props} />;
}

export default VisionBoardPage;
