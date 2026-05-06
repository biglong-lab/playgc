import { DinnerTable } from "./DinnerTable";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function DinnerTablePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <DinnerTable
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
