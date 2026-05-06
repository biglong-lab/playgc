import { PartyMenu } from "./PartyMenu";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PartyMenuPage(props: Props) {
  return <PartyMenu {...props} />;
}
