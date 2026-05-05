import { QuestionJar } from "./QuestionJar";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function QuestionJarPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <QuestionJar
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
