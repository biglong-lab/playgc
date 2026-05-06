import { LighthouseBeam } from "./LighthouseBeam";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function LighthouseBeamPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <LighthouseBeam
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
