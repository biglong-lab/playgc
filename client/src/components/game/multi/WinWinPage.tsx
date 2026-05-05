import { WinWin } from "./WinWin";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function WinWinPage(props: Props) {
  return <WinWin {...props} />;
}
