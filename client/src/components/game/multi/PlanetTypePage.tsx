import { PlanetType } from "./PlanetType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PlanetTypePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <PlanetType
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
