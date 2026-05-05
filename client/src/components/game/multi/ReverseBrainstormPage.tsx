import { ReverseBrainstorm } from "./ReverseBrainstorm";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ReverseBrainstormPage(props: Props) {
  return <ReverseBrainstorm {...props} />;
}
