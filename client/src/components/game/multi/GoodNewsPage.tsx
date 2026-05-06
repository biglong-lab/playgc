import { GoodNews } from "./GoodNews";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GoodNewsPage(props: Props) {
  return <GoodNews {...props} />;
}

export default GoodNewsPage;
