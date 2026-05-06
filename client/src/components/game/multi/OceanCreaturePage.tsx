import { OceanCreature } from "./OceanCreature";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function OceanCreaturePage(props: Props) {
  return <OceanCreature {...props} />;
}
