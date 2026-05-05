import { ReflectionCard } from "./ReflectionCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ReflectionCardPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ReflectionCard
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
