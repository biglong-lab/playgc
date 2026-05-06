import { BirthdayCandle } from "./BirthdayCandle";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function BirthdayCandlePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <BirthdayCandle
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
