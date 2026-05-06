import { PeerPraise } from "./PeerPraise";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PeerPraisePage(props: Props) {
  return <PeerPraise {...props} />;
}
