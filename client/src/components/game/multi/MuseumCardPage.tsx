import { MuseumCard } from "./MuseumCard";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: Record<string, unknown>;
}

export default function MuseumCardPage({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  return (
    <MuseumCard
      gameId={gameId}
      sessionId={sessionId}
      pageId={pageId}
      isTeamLead={isTeamLead}
      config={config as { title?: string; prompt?: string } | undefined}
    />
  );
}
