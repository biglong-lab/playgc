import { PersonalHighlight } from "./PersonalHighlight";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PersonalHighlightPage(props: Props) {
  return <PersonalHighlight {...props} />;
}
