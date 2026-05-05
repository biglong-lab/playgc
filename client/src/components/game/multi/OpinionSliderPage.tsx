import { OpinionSlider } from "./OpinionSlider";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function OpinionSliderPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <OpinionSlider
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
