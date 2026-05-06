import { PizzaType } from "./PizzaType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PizzaTypePage(props: Props) {
  return <PizzaType {...props} />;
}
