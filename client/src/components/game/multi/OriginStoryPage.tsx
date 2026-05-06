import { OriginStory } from "./OriginStory";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function OriginStoryPage(props: Props) {
  return <OriginStory {...props} />;
}

export default OriginStoryPage;
