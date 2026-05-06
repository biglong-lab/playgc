import { FavMemory } from "./FavMemory";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FavMemoryPage(props: Props) {
  return <FavMemory {...props} />;
}

export default FavMemoryPage;
