import { ClosingThought } from "./ClosingThought";
interface Props { gameId: string; sessionId: string; pageId: string; config?: Record<string, unknown>; isTeamLead?: boolean; }
export default function ClosingThoughtPage(props: Props) { return <ClosingThought {...props} />; }
