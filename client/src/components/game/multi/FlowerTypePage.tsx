import { FlowerType } from "./FlowerType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function FlowerTypePage(props: Props) {
  return <FlowerType {...props} />;
}
