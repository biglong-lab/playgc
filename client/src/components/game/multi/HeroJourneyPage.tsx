import { HeroJourney } from "./HeroJourney";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function HeroJourneyPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <HeroJourney
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
