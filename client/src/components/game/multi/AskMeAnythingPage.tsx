import { AskMeAnything } from "./AskMeAnything";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function AskMeAnythingPage(props: Props) {
  return <AskMeAnything {...props} />;
}

export default AskMeAnythingPage;
