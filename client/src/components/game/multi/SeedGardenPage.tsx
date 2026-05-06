import { SeedGarden } from "./SeedGarden";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function SeedGardenPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <SeedGarden
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
