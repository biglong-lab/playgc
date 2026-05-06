import { ChocolateType } from "./ChocolateType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ChocolateTypePage(props: Props) {
  return <ChocolateType {...props} />;
}
