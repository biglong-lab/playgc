import { PuzzlePiece } from "./PuzzlePiece";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function PuzzlePiecePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <PuzzlePiece
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
