import { DiscoveryCard } from "./DiscoveryCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function DiscoveryCardPage(props: Props) {
  return <DiscoveryCard {...props} />;
}
