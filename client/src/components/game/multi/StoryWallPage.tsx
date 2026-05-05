import { StoryWall } from "./StoryWall";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StoryWallPage(props: Props) {
  return <StoryWall {...props} />;
}

export default StoryWallPage;
