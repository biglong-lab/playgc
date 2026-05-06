import { LegacyWord } from "./LegacyWord";
interface Props { gameId: string; sessionId: string; pageId: string; config?: Record<string, unknown>; isTeamLead?: boolean; }
export default function LegacyWordPage(props: Props) { return <LegacyWord {...props} />; }
