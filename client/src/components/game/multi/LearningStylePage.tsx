import { LearningStyle } from "./LearningStyle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LearningStylePage(props: Props) {
  return <LearningStyle {...props} />;
}

export default LearningStylePage;
