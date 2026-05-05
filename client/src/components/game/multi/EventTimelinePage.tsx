import { EventTimeline } from "./EventTimeline";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function EventTimelinePage(props: Props) {
  return <EventTimeline {...props} />;
}

export default EventTimelinePage;
