import { AwardCeremony } from "./AwardCeremony";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function AwardCeremonyPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <AwardCeremony
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
