import { PetPersonality } from "./PetPersonality";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PetPersonalityPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <PetPersonality
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
