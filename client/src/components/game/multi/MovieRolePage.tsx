import { MovieRole } from "./MovieRole";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MovieRolePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <MovieRole
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
