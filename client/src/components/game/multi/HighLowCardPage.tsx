import { HighLowCard } from "./HighLowCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function HighLowCardPage(props: Props) {
  return <HighLowCard {...props} />;
}
