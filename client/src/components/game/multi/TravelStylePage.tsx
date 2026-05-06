import { TravelStyle } from "./TravelStyle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function TravelStylePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <TravelStyle
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
