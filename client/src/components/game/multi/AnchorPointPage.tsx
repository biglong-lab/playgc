import { AnchorPoint } from "./AnchorPoint";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function AnchorPointPage(props: Props) {
  return <AnchorPoint {...props} />;
}
