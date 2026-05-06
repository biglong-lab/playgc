import { SushiType } from "./SushiType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SushiTypePage(props: Props) {
  return <SushiType {...props} />;
}
