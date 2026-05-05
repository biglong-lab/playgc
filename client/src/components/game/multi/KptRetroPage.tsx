import { KptRetro } from "./KptRetro";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function KptRetroPage(props: Props) {
  return <KptRetro {...props} />;
}
