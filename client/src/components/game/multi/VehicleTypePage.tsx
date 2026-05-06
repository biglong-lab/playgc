import { VehicleType } from "./VehicleType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function VehicleTypePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <VehicleType
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
