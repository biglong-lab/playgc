import { LearningObjective } from "./LearningObjective";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function LearningObjectivePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <LearningObjective
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
