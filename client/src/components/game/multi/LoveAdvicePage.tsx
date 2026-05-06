import { LoveAdvice } from "./LoveAdvice";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LoveAdvicePage(props: Props) {
  return <LoveAdvice {...props} />;
}

export default LoveAdvicePage;
