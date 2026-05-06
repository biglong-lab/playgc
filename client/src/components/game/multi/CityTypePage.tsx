import { CityType } from "./CityType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function CityTypePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <CityType
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
