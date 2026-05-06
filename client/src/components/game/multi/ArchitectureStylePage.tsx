import { ArchitectureStyle } from "./ArchitectureStyle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ArchitectureStylePage(props: Props) {
  return <ArchitectureStyle {...props} />;
}
