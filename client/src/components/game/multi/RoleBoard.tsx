import { Loader2, Users, CheckCircle2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RolePick extends Record<string, unknown> {
  userId: string;
  userName: string;
  roleId: string;
}

interface RoleBoardState extends Record<string, unknown> {
  picks: RolePick[];
  revealed: boolean;
}

interface RoleBoardConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): RoleBoardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ROLES = [
  { id: "leader", label: "領導者", icon: "👑", desc: "帶領方向、做決策" },
  { id: "creator", label: "創意者", icon: "💡", desc: "發想點子、突破框架" },
  { id: "executor", label: "執行者", icon: "⚡", desc: "落實計劃、達成目標" },
  { id: "connector", label: "協調者", icon: "🤝", desc: "串連成員、化解衝突" },
  { id: "observer", label: "觀察者", icon: "🔍", desc: "深度分析、提供洞察" },
];

const ROLE_COLORS: Record<string, string> = {
  leader: "bg-amber-50 border-amber-400 text-amber-700",
  creator: "bg-violet-50 border-violet-400 text-violet-700",
  executor: "bg-blue-50 border-blue-400 text-blue-700",
  connector: "bg-green-50 border-green-400 text-green-700",
  observer: "bg-slate-50 border-slate-400 text-slate-700",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function RoleBoard({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<RoleBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "role_board",
    defaultState: { picks: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="rlb-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const picks = state.picks as RolePick[];
  const revealed = state.revealed as boolean;
  const myPick = picks.find((p) => p.userId === userId);

  const handlePick = (roleId: string) => {
    if (myPick) return;
    const pick: RolePick = { userId, userName, roleId };
    updateState({ ...state, picks: [...picks, pick] });
  };

  const rolePickCount = (roleId: string) => picks.filter((p) => p.roleId === roleId).length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="rlb-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我在隊伍中的角色"}
      </div>
      <div data-testid="rlb-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "選一個最能代表你在這個隊伍中的角色"}
      </div>
      <div data-testid="rlb-count" className="text-xs text-center text-muted-foreground">
        已有 {picks.length} 人選擇角色
      </div>

      {!myPick && (
        <div data-testid="rlb-role-grid" className="grid grid-cols-1 gap-2">
          {ROLES.map((role) => (
            <button
              key={role.id}
              data-testid={`rlb-role-${role.id}`}
              onClick={() => handlePick(role.id)}
              className="flex items-center gap-3 rounded-xl p-3 border text-left hover:bg-accent transition-colors"
            >
              <span className="text-2xl">{role.icon}</span>
              <div>
                <div className="font-semibold text-sm">{role.label}</div>
                <div className="text-xs text-muted-foreground">{role.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {myPick && (
        <div
          data-testid="rlb-my-pick"
          className={`rounded-xl p-4 border-2 ${ROLE_COLORS[myPick.roleId] ?? "bg-card border-border"}`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-semibold">你的角色：</span>
            <span className="text-sm">
              {ROLES.find((r) => r.id === myPick.roleId)?.icon}{" "}
              {ROLES.find((r) => r.id === myPick.roleId)?.label}
            </span>
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="rlb-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Users className="w-4 h-4" />
          揭曉隊伍角色分布
        </button>
      )}

      {revealed && picks.length === 0 && (
        <div data-testid="rlb-empty" className="text-center text-muted-foreground p-8">
          還沒有人選擇角色
        </div>
      )}

      {revealed && picks.length > 0 && (
        <div data-testid="rlb-result" className="flex flex-col gap-2">
          <div data-testid="rlb-result-title" className="text-sm font-semibold text-center text-indigo-700 flex items-center justify-center gap-1">
            <Users className="w-4 h-4" />
            隊伍角色組成
          </div>
          {ROLES.filter((r) => rolePickCount(r.id) > 0).map((role) => {
            const rolePicks = picks.filter((p) => p.roleId === role.id);
            return (
              <div
                key={role.id}
                data-testid={`rlb-result-${role.id}`}
                className={`rounded-xl p-3 border ${ROLE_COLORS[role.id] ?? ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{role.icon}</span>
                    <span className="font-semibold text-sm">{role.label}</span>
                  </div>
                  <span className="text-xs font-bold">{rolePicks.length} 人</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {rolePicks.map((p) => p.userName).join("、")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
