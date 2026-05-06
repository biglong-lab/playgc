import { MicroCommit } from "./MicroCommit";
interface Props { gameId: string; sessionId: string; pageId: string; config?: Record<string, unknown>; isTeamLead?: boolean; }
export default function MicroCommitPage(props: Props) { return <MicroCommit {...props} />; }
