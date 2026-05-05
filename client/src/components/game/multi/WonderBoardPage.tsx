import { WonderBoard } from "./WonderBoard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function WonderBoardPage(props: Props) {
  return <WonderBoard {...props} />;
}
