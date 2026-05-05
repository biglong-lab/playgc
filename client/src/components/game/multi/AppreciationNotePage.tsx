import { AppreciationNote } from "./AppreciationNote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function AppreciationNotePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <AppreciationNote
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
