import { MeetingRating } from "./MeetingRating";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MeetingRatingPage(props: Props) {
  return <MeetingRating {...props} />;
}

export default MeetingRatingPage;
