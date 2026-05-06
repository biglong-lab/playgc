import { SpiceType } from "./SpiceType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SpiceTypePage(props: Props) {
  return <SpiceType {...props} />;
}
