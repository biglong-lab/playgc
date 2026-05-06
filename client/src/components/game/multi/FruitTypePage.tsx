import { FruitType } from "./FruitType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FruitTypePage(props: Props) {
  return <FruitType {...props} />;
}
