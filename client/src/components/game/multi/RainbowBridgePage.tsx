import { RainbowBridge } from "./RainbowBridge";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function RainbowBridgePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <RainbowBridge
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
