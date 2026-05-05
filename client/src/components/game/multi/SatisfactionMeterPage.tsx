import { SatisfactionMeter } from "./SatisfactionMeter";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SatisfactionMeterPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <SatisfactionMeter
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
