import { GiveGet } from "./GiveGet";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GiveGetPage(props: Props) {
  return <GiveGet {...props} />;
}

export default GiveGetPage;
