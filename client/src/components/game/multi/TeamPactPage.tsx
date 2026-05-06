import { TeamPact } from "./TeamPact";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamPactPage(props: Props) {
  return <TeamPact {...props} />;
}

export default TeamPactPage;
