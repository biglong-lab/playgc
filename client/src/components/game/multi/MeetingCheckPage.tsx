import { MeetingCheck } from "./MeetingCheck";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MeetingCheckPage(props: Props) {
  return <MeetingCheck {...props} />;
}
