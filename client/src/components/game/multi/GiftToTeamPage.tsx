import { GiftToTeam } from "./GiftToTeam";
interface Props { gameId: string; sessionId: string; pageId: string; config?: Record<string, unknown>; isTeamLead?: boolean; }
export default function GiftToTeamPage(props: Props) { return <GiftToTeam {...props} />; }
