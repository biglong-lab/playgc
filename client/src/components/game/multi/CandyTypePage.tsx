import { CandyType } from "./CandyType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function CandyTypePage(props: Props) {
  return <CandyType {...props} />;
}
