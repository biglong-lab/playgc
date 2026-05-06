import { BookGenre } from "./BookGenre";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function BookGenrePage(props: Props) {
  return <BookGenre {...props} />;
}
