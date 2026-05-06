import { CoffeeType } from "./CoffeeType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function CoffeeTypePage(props: Props) {
  return <CoffeeType {...props} />;
}
