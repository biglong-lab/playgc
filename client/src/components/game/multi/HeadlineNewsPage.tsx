import { HeadlineNews } from "./HeadlineNews";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function HeadlineNewsPage(props: Props) {
  return <HeadlineNews {...props} />;
}
