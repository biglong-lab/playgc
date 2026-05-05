import { SafetyCheck } from "./SafetyCheck";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SafetyCheckPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <SafetyCheck
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
