import { AnimalSpirit } from "./AnimalSpirit";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function AnimalSpiritPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <AnimalSpirit
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
