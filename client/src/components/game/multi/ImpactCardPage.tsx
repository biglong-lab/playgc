import { ImpactCard } from "./ImpactCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ImpactCardPage(props: Props) {
  return <ImpactCard {...props} />;
}
