import { BirdType } from "./BirdType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function BirdTypePage(props: Props) {
  return <BirdType {...props} />;
}
