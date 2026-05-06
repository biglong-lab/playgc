import { LandscapeType } from "./LandscapeType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function LandscapeTypePage(props: Props) {
  return <LandscapeType {...props} />;
}
