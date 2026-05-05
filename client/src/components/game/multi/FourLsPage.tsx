import { FourLs } from "./FourLs";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FourLsPage(props: Props) {
  return <FourLs {...props} />;
}
