import { SparkCapture } from "./SparkCapture";
interface Props { gameId: string; sessionId: string; pageId: string; config?: Record<string, unknown>; isTeamLead?: boolean; }
export default function SparkCapturePage(props: Props) { return <SparkCapture {...props} />; }
