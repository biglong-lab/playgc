import { MoodWeather } from "./MoodWeather";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MoodWeatherPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <MoodWeather
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
