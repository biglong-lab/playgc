import { FoodMood } from "./FoodMood";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FoodMoodPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <FoodMood
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
