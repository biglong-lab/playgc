import { AfterAction } from "./AfterAction";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function AfterActionPage(props: Props) {
  return <AfterAction {...props} />;
}
