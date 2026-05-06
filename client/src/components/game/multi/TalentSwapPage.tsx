import { TalentSwap } from "./TalentSwap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TalentSwapPage(props: Props) {
  return <TalentSwap {...props} />;
}

export default TalentSwapPage;
