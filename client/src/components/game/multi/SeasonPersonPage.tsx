import { SeasonPerson } from "./SeasonPerson";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SeasonPersonPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <SeasonPerson
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
