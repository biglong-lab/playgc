import { ObstacleMap } from "./ObstacleMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ObstacleMapPage(props: Props) {
  return <ObstacleMap {...props} />;
}
