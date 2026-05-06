import { PeerMirror } from "./PeerMirror";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PeerMirrorPage(props: Props) {
  return <PeerMirror {...props} />;
}

export default PeerMirrorPage;
