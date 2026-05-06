import { WishList } from "./WishList";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function WishListPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <WishList
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
