import { CommonGround } from "./CommonGround";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function CommonGroundPage(props: Props) {
  return <CommonGround {...props} />;
}
