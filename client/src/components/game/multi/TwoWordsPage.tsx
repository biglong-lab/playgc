import { TwoWords } from "./TwoWords";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function TwoWordsPage(props: Props) {
  return <TwoWords {...props} />;
}
