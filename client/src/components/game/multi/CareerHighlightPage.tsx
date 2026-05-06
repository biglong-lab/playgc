import { CareerHighlight } from "./CareerHighlight";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CareerHighlightPage(props: Props) {
  return <CareerHighlight {...props} />;
}

export default CareerHighlightPage;
