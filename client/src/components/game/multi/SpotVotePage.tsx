import { SpotVote } from "./SpotVote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function SpotVotePage(props: Props) {
  return <SpotVote {...props} />;
}
