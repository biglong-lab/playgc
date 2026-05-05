import { PeakMoment } from "./PeakMoment";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function PeakMomentPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <PeakMoment
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
