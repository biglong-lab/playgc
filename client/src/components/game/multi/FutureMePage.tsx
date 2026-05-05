import { FutureMe } from "./FutureMe";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FutureMePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <FutureMe
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
