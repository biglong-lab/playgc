import { InsectType } from "./InsectType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function InsectTypePage(props: Props) {
  return <InsectType {...props} />;
}
