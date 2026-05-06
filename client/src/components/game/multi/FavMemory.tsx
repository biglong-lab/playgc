import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MemoryEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  memory: string;
  period: string;
}

interface FavMemoryState extends Record<string, unknown> {
  entries: MemoryEntry[];
  revealed: boolean;
}

interface FavMemoryConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): FavMemoryConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const PERIODS = [
  { id: "long_ago", label: "很久以前", emoji: "⏳" },
  { id: "five_years", label: "5年前", emoji: "📅" },
  { id: "few_years", label: "2-3年前", emoji: "🗓️" },
  { id: "last_year", label: "去年", emoji: "🌿" },
  { id: "this_year", label: "今年", emoji: "✨" },
  { id: "recently", label: "最近", emoji: "🌟" },
];

const CARD_GRADIENTS = [
  "from-violet-50 to-purple-50 border-violet-200",
  "from-blue-50 to-sky-50 border-blue-200",
  "from-teal-50 to-cyan-50 border-teal-200",
  "from-amber-50 to-yellow-50 border-amber-200",
  "from-rose-50 to-pink-50 border-rose-200",
  "from-lime-50 to-green-50 border-lime-200",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FavMemory({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FavMemoryState>({
    gameId,
    sessionId,
    pageId,
    type: "fav_memory",
    defaultState: { entries: [], revealed: false },
  });

  const [memory, setMemory] = useState("");
  const [period, setPeriod] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="fm-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MemoryEntry[]).find((e) => e.userId === userId);
  const canSubmit = memory.trim().length >= 5 && period !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MemoryEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      memory: memory.trim(),
      period,
    };
    updateState({ ...state, entries: [...(state.entries as MemoryEntry[]), entry] });
    setMemory("");
    setPeriod("");
  };

  const entries = state.entries as MemoryEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="fm-title" className="text-xl font-bold text-center">
        {cfg.title ?? "最愛回憶"}
      </div>
      <div data-testid="fm-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "分享一個你最珍惜的共同回憶，讓大家重溫美好時光！"}
      </div>
      <div data-testid="fm-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="fm-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                data-testid={`fm-period-${p.id}`}
                onClick={() => setPeriod(p.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${period === p.id ? "border-violet-400 bg-violet-50 font-semibold" : "hover:border-violet-300"}`}
              >
                <span className="text-xl mb-1">{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="fm-memory-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="描述這段回憶（至少5字）..."
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
          />
          <button
            data-testid="fm-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            分享回憶
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="fm-my-entry" className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <div className="text-xs text-violet-500 mb-1">
            {PERIODS.find((p) => p.id === myEntry.period)?.emoji}{" "}
            {PERIODS.find((p) => p.id === myEntry.period)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.memory}</div>
          <div className="text-xs text-muted-foreground mt-1">已分享</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="fm-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全場回憶
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="fm-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享回憶
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="fm-result" className="flex flex-col gap-3">
          <div data-testid="fm-memory-wall" className="flex flex-col gap-3">
            {entries.map((e, i) => {
              const p = PERIODS.find((pd) => pd.id === e.period);
              return (
                <div
                  key={e.entryId}
                  data-testid={`fm-card-${e.entryId}`}
                  className={`rounded-xl p-4 border bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{p?.emoji}</span>
                    <span className="text-xs font-medium text-muted-foreground">{p?.label}</span>
                    <span className="ml-auto text-xs font-semibold">{e.userName}</span>
                  </div>
                  <div className="text-sm">{e.memory}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
