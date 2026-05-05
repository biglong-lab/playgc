import { MicroBio } from "./MicroBio";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export default function MicroBioPage(props: Props) {
  return <MicroBio {...props} />;
}
