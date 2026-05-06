import { SportVibes } from "./SportVibes";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SportVibesPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  return (
    <SportVibes
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      config={config}
      isTeamLead={isTeamLead}
    />
  );
}
