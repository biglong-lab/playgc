import { OceanWave } from "./OceanWave";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function OceanWavePage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <OceanWave
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
