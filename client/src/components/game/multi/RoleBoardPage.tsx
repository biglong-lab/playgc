import { RoleBoard } from "./RoleBoard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function RoleBoardPage(props: Props) {
  return <RoleBoard {...props} />;
}
