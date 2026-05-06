import { DreamJob } from "./DreamJob";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function DreamJobPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <DreamJob
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
