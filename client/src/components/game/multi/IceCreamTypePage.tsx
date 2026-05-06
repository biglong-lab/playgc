import { IceCreamType } from "./IceCreamType";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function IceCreamTypePage(props: Props) {
  return <IceCreamType {...props} />;
}
