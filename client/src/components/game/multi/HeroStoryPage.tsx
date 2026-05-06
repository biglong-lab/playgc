import { HeroStory } from "./HeroStory";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HeroStoryPage(props: Props) {
  return <HeroStory {...props} />;
}

export default HeroStoryPage;
