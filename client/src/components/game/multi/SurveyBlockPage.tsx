import { SurveyBlock } from "./SurveyBlock";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SurveyBlockPage(props: Props) {
  return <SurveyBlock {...props} />;
}

export default SurveyBlockPage;
