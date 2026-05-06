import { MagicWand } from "./MagicWand";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function MagicWandPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <MagicWand
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
