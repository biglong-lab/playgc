import { EnergyMap } from "./EnergyMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function EnergyMapPage(props: Props) {
  return <EnergyMap {...props} />;
}

export default EnergyMapPage;
