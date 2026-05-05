import { OpenQuiz } from "./OpenQuiz";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function OpenQuizPage(props: Props) {
  return <OpenQuiz {...props} />;
}
