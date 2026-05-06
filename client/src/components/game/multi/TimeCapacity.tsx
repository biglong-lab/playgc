import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CapacityEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  allocation: Record<string, number>;
}

interface TimeCapacityState extends Record<string, unknown> {
  entries: CapacityEntry[];
  revealed: boolean;
}

interface TimeCapacityConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): TimeCapacityConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const DOMAINS = [
  { id: "work", label: "工作事業", emoji: "💼", color: "bg-blue-100 text-blue-700" },
  { id: "family", label: "家庭生活", emoji: "🏠", color: "bg-green-100 text-green-700" },
  { id: "health", label: "健康運動", emoji: "🏃", color: "bg-red-100 text-red-700" },
  { id: "social", label: "社交娛樂", emoji: "🎉", color: "bg-yellow-100 text-yellow-700" },
  { id: "learning", label: "學習成長", emoji: "📚", color: "bg-purple-100 text-purple-700" },
  { id: "rest", label: "休息充電", emoji: "😴", color: "bg-gray-100 text-gray-700" },
];

const TOTAL_HOURS = 168;

const DEFAULT_ALLOC: Record<string, number> = {
  work: 40,
  family: 30,
  health: 14,
  social: 14,
  learning: 14,
  rest: 56,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TimeCapacity({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TimeCapacityState>({
    gameId,
    sessionId,
    pageId,
    type: "time_capacity",
    defaultState: { entries: [], revealed: false },
  });

  const [allocation, setAllocation] = useState<Record<string, number>>(DEFAULT_ALLOC);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="tc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as CapacityEntry[]).find((e) => e.userId === userId);
  const totalUsed = Object.values(allocation).reduce((s, v) => s + v, 0);
  const canSubmit = totalUsed === TOTAL_HOURS;

  const handleChange = (domainId: string, value: number) => {
    setAllocation((prev) => ({ ...prev, [domainId]: Math.max(0, value) }));
  };

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: CapacityEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      allocation: { ...allocation },
    };
    updateState({ ...state, entries: [...(state.entries as CapacityEntry[]), entry] });
  };

  const entries = state.entries as CapacityEntry[];
  const revealed = state.revealed as boolean;

  const avgAlloc = entries.length > 0
    ? DOMAINS.reduce<Record<string, number>>((acc, d) => {
        acc[d.id] = Math.round(entries.reduce((s, e) => s + ((e.allocation as Record<string, number>)[d.id] ?? 0), 0) / entries.length);
        return acc;
      }, {})
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="tc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "時間分配"}
      </div>
      <div data-testid="tc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "你如何分配一週 168 小時？分享你的時間比例！"}
      </div>
      <div data-testid="tc-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="tc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div data-testid="tc-total" className={`text-center text-sm font-semibold ${totalUsed === TOTAL_HOURS ? "text-green-600" : totalUsed > TOTAL_HOURS ? "text-red-500" : "text-orange-500"}`}>
            已分配：{totalUsed} / {TOTAL_HOURS} 小時
          </div>
          <div className="flex flex-col gap-2">
            {DOMAINS.map((d) => (
              <div key={d.id} data-testid={`tc-domain-${d.id}`} className="flex items-center gap-3">
                <span className="text-base">{d.emoji}</span>
                <span className="text-xs w-16 shrink-0">{d.label}</span>
                <input
                  data-testid={`tc-input-${d.id}`}
                  type="number"
                  min={0}
                  max={TOTAL_HOURS}
                  value={allocation[d.id]}
                  onChange={(e) => handleChange(d.id, parseInt(e.target.value) || 0)}
                  className="border rounded-lg px-2 py-1 text-sm w-16 text-center"
                />
                <span className="text-xs text-muted-foreground">小時</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    data-testid={`tc-bar-${d.id}`}
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (allocation[d.id] / TOTAL_HOURS) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            data-testid="tc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-blue-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            提交我的時間分配
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="tc-my-entry" className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="text-xs text-blue-500 mb-2">我的時間分配</div>
          <div className="grid grid-cols-3 gap-1">
            {DOMAINS.map((d) => (
              <div key={d.id} className={`rounded-lg p-1.5 text-center ${d.color}`}>
                <div className="text-xs">{d.emoji} {d.label}</div>
                <div className="text-sm font-bold">{(myEntry.allocation as Record<string, number>)[d.id]}h</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="tc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-blue-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊時間分配
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="tc-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享時間分配
        </div>
      )}

      {revealed && entries.length > 0 && avgAlloc && (
        <div data-testid="tc-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center">全隊平均時間分配</div>
          <div data-testid="tc-avg-chart" className="flex flex-col gap-2">
            {DOMAINS.map((d) => (
              <div key={d.id} data-testid={`tc-avg-${d.id}`} className="flex items-center gap-3">
                <span className="text-base">{d.emoji}</span>
                <span className="text-xs w-16 shrink-0">{d.label}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${Math.min(100, ((avgAlloc[d.id] ?? 0) / TOTAL_HOURS) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-8 text-right">{avgAlloc[d.id]}h</span>
              </div>
            ))}
          </div>
          <div data-testid="tc-member-list" className="flex flex-col gap-2 mt-2">
            {entries.map((e) => (
              <div key={e.entryId} data-testid={`tc-card-${e.entryId}`} className="bg-gray-50 rounded-xl p-2 border text-xs">
                <div className="font-semibold mb-1">{e.userName}</div>
                <div className="flex gap-1 flex-wrap">
                  {DOMAINS.map((d) => (
                    <span key={d.id} className={`rounded px-1.5 py-0.5 ${d.color}`}>
                      {d.emoji} {(e.allocation as Record<string, number>)[d.id]}h
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
