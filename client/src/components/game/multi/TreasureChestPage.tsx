import { TreasureChest } from "./TreasureChest";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function TreasureChestPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <TreasureChest
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
