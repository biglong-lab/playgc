import { DrumCircle } from "./DrumCircle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function DrumCirclePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <DrumCircle
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
