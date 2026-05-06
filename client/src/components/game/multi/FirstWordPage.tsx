import { FirstWord } from "./FirstWord";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FirstWordPage(props: Props) {
  return <FirstWord {...props} />;
}
