import { ColorPersonality } from "./ColorPersonality";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ColorPersonalityPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ColorPersonality
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
