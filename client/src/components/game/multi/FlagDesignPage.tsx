import { FlagDesign } from "./FlagDesign";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FlagDesignPage(props: Props) {
  return <FlagDesign {...props} />;
}
