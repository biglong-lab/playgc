import { HeroType } from "./HeroType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function HeroTypePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <HeroType
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
