import { FlashCard } from "./FlashCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FlashCardPage(props: Props) {
  return <FlashCard {...props} />;
}

export default FlashCardPage;
