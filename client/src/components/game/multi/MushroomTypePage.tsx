import { MushroomType } from "./MushroomType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MushroomTypePage(props: Props) {
  return <MushroomType {...props} />;
}
