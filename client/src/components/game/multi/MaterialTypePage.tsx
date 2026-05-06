import { MaterialType } from "./MaterialType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MaterialTypePage(props: Props) {
  return <MaterialType {...props} />;
}
