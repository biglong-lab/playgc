import { StrengthMap } from "./StrengthMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function StrengthMapPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <StrengthMap
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
