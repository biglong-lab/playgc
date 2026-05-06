import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RoleEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  role: string;
  reason: string;
}

interface MovieRoleState extends Record<string, unknown> {
  entries: RoleEntry[];
  revealed: boolean;
}

interface MovieRoleConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MovieRoleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ROLES = [
  { id: "hero", label: "主角", emoji: "⭐", desc: "勇於承擔推動故事" },
  { id: "mentor", label: "導師", emoji: "🧓", desc: "智慧引導傳承經驗" },
  { id: "sidekick", label: "夥伴", emoji: "🤝", desc: "忠誠相伴鼎力支持" },
  { id: "villain", label: "反派", emoji: "😈", desc: "挑戰現狀製造張力" },
  { id: "trickster", label: "搗蛋鬼", emoji: "🃏", desc: "打破規則製造驚喜" },
  { id: "sage", label: "智者", emoji: "🦉", desc: "洞察本質提供視角" },
  { id: "guardian", label: "守護者", emoji: "🛡️", desc: "保護珍視的人與事" },
  { id: "creator", label: "創造者", emoji: "🎨", desc: "無中生有帶來新意" },
];

const CARD_COLORS = [
  "border-l-yellow-400 bg-yellow-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-red-400 bg-red-50",
  "border-l-green-400 bg-green-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-orange-400 bg-orange-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MovieRole({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MovieRoleState>({
    gameId,
    sessionId,
    pageId,
    type: "movie_role",
    defaultState: { entries: [], revealed: false },
  });

  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mr-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as RoleEntry[]).find((e) => e.userId === userId);
  const canSubmit = role !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: RoleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      role,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as RoleEntry[]), entry] });
    setRole("");
    setReason("");
  };

  const entries = state.entries as RoleEntry[];
  const revealed = state.revealed as boolean;

  const roleCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.role] = (acc[e.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mr-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我在故事中的角色"}
      </div>
      <div data-testid="mr-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是電影或故事裡的角色，你最像哪一種？說說你的原因！"}
      </div>
      <div data-testid="mr-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mr-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                data-testid={`mr-role-${r.id}`}
                onClick={() => setRole(r.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${role === r.id ? "border-yellow-500 bg-yellow-50 font-semibold" : "hover:border-yellow-400"}`}
              >
                <span className="text-xl shrink-0">{r.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-muted-foreground text-[10px]">{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mr-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這個角色最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mr-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            登場！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mr-my-entry" className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{ROLES.find((r) => r.id === myEntry.role)?.emoji}</span>
            <span className="text-sm font-semibold">{ROLES.find((r) => r.id === myEntry.role)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已登場</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mr-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊故事卡司
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mr-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇角色
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mr-result" className="flex flex-col gap-3">
          <div data-testid="mr-role-summary" className="flex flex-wrap gap-2">
            {ROLES.filter((r) => roleCounts[r.id] > 0).map((r) => (
              <div
                key={r.id}
                data-testid={`mr-badge-${r.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold"
              >
                {r.emoji} {r.label}
                <span className="ml-1 bg-yellow-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {roleCounts[r.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mr-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const r = ROLES.find((x) => x.id === e.role);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mr-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{r?.emoji}</span>
                    <span className="text-sm font-semibold">{r?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
