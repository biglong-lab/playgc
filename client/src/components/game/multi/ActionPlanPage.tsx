import { ActionPlan } from "./ActionPlan";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ActionPlanPage(props: Props) {
  return <ActionPlan {...props} />;
}

export default ActionPlanPage;
