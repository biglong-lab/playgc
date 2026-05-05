import { SignalMap } from "./SignalMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SignalMapPage(props: Props) {
  return <SignalMap {...props} />;
}

export default SignalMapPage;
