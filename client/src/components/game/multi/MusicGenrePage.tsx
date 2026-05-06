import { MusicGenre } from "./MusicGenre";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MusicGenrePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <MusicGenre
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
