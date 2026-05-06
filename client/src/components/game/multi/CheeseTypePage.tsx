import { CheeseType } from "./CheeseType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function CheeseTypePage(props: Props) {
  return <CheeseType {...props} />;
}
