import { ValuesCard } from "./ValuesCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ValuesCardPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ValuesCard
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
