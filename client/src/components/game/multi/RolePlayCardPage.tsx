import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import RolePlayCard, { RolePlayCardConfig, RolePlayCardState, RoleAssignment } from "./RolePlayCard";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: RolePlayCardState = { assignments: [], revealed: false };

export default function RolePlayCardPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<RolePlayCardState>({
    gameId,
    sessionId,
    pageId,
    type: "role_play_card",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: RolePlayCardConfig =
    "roles" in r && Array.isArray(r.roles)
      ? (r as unknown as RolePlayCardConfig)
      : r.config && "roles" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as RolePlayCardConfig)
        : { title: "角色扮演卡", roles: ["領導者", "觀察者", "挑戰者", "支持者"] };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleDraw() {
    const already = state.assignments.some((a) => a.userId === myUserId);
    if (already || config.roles.length === 0) return;
    const usedRoles = state.assignments.map((a) => a.role);
    const available = config.roles.filter((r) => !usedRoles.includes(r));
    const pool = available.length > 0 ? available : config.roles;
    const role = pool[Math.floor(Math.random() * pool.length)];
    const assignment: RoleAssignment = {
      assignId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      role,
    };
    updateState({ ...state, assignments: [...state.assignments, assignment] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <RolePlayCard
      config={config}
      state={state}
      myUserId={myUserId}
      onDraw={handleDraw}
      onReveal={handleReveal}
    />
  );
}
