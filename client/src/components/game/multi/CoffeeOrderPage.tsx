import { CoffeeOrder } from "./CoffeeOrder";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function CoffeeOrderPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <CoffeeOrder
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
