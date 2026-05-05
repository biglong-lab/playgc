import { TwoByTwo } from "./TwoByTwo";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TwoByTwoPage(props: Props) {
  return <TwoByTwo {...props} />;
}

export default TwoByTwoPage;
