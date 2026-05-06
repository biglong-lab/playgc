import { SoupIngredient } from "./SoupIngredient";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function SoupIngredientPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <SoupIngredient
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
