import { GiftBox } from "./GiftBox";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GiftBoxPage(props: Props) {
  return <GiftBox {...props} />;
}

export default GiftBoxPage;
