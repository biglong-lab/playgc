import { PortalDoor } from "./PortalDoor";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function PortalDoorPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <PortalDoor
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
