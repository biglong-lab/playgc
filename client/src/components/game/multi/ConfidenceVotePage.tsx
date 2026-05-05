import { ConfidenceVote } from "./ConfidenceVote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function ConfidenceVotePage(props: Props) {
  return <ConfidenceVote {...props} />;
}
