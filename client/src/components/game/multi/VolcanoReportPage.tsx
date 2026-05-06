import { VolcanoReport } from "./VolcanoReport";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function VolcanoReportPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <VolcanoReport
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
