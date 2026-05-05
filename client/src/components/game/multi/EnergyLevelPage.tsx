import { EnergyLevel } from "./EnergyLevel";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function EnergyLevelPage(props: Props) {
  return <EnergyLevel {...props} />;
}

export default EnergyLevelPage;
