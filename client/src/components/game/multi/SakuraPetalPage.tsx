import { SakuraPetal } from "./SakuraPetal";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function SakuraPetalPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <SakuraPetal
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
