import { ElementalType } from "./ElementalType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ElementalTypePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <ElementalType
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
