import { GemstoneType } from "./GemstoneType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function GemstoneTypePage(props: Props) {
  return <GemstoneType {...props} />;
}
