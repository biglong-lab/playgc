import { TimeCapacity } from "./TimeCapacity";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function TimeCapacityPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <TimeCapacity
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
