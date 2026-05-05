import { YesNoMaybe } from "./YesNoMaybe";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function YesNoMaybePage(props: Props) {
  return <YesNoMaybe {...props} />;
}

export default YesNoMaybePage;
