import { SkillShowcase } from "./SkillShowcase";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SkillShowcasePage(props: Props) {
  return <SkillShowcase {...props} />;
}

export default SkillShowcasePage;
