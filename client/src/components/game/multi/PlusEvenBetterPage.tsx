import { PlusEvenBetter } from "./PlusEvenBetter";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PlusEvenBetterPage(props: Props) {
  return <PlusEvenBetter {...props} />;
}
