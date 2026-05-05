import { RoseBudThorn } from "./RoseBudThorn";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function RoseBudThornPage(props: Props) {
  return <RoseBudThorn {...props} />;
}

export default RoseBudThornPage;
