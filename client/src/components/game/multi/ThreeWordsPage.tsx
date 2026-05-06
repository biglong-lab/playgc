import { ThreeWords } from "./ThreeWords";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ThreeWordsPage(props: Props) {
  return <ThreeWords {...props} />;
}

export default ThreeWordsPage;
