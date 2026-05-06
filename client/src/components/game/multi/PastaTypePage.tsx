import { PastaType } from "./PastaType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PastaTypePage(props: Props) {
  return <PastaType {...props} />;
}
