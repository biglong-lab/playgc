import { MovieGenre } from "./MovieGenre";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MovieGenrePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <MovieGenre
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
