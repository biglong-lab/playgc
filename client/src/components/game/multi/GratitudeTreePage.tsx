import { GratitudeTree } from "./GratitudeTree";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function GratitudeTreePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <GratitudeTree
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
