import { MythicalCreature } from "./MythicalCreature";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MythicalCreaturePage(props: Props) {
  return <MythicalCreature {...props} />;
}
