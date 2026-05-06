import { SafetyLevel } from "./SafetyLevel";
interface Props { gameId: string; sessionId: string; pageId: string; config?: Record<string, unknown>; isTeamLead?: boolean; }
export default function SafetyLevelPage(props: Props) { return <SafetyLevel {...props} />; }
