import { FishType } from "./FishType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FishTypePage(props: Props) {
  return <FishType {...props} />;
}
