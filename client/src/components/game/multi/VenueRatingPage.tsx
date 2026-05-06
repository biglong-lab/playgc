import { VenueRating } from "./VenueRating";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function VenueRatingPage(props: Props) {
  return <VenueRating {...props} />;
}
