import { LifeLesson } from "./LifeLesson";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function LifeLessonPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <LifeLesson
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
