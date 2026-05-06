import { useState } from "react";
import { Loader2, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface HighLowEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  high: string;
  low: string;
}

interface HighLowCardState extends Record<string, unknown> {
  entries: HighLowEntry[];
  revealed: boolean;
}

interface HighLowCardConfig {
  title?: string;
  highPrompt?: string;
  lowPrompt?: string;
  highPlaceholder?: string;
  lowPlaceholder?: string;
}

function extractConfig(raw: Record<string, unknown>): HighLowCardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    highPrompt: typeof raw.highPrompt === "string" ? raw.highPrompt : undefined,
    lowPrompt: typeof raw.lowPrompt === "string" ? raw.lowPrompt : undefined,
    highPlaceholder: typeof raw.highPlaceholder === "string" ? raw.highPlaceholder : undefined,
    lowPlaceholder: typeof raw.lowPlaceholder === "string" ? raw.lowPlaceholder : undefined,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HighLowCard({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<HighLowCardState>({
    gameId,
    sessionId,
    pageId,
    type: "high_low_card",
    defaultState: { entries: [], revealed: false },
  });

  const [high, setHigh] = useState("");
  const [low, setLow] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="hlc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const entries = state.entries as HighLowEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === userId);
  const canSubmit = high.trim().length >= 2 && low.trim().length >= 2;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: HighLowEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      high: high.trim(),
      low: low.trim(),
    };
    updateState({ ...state, entries: [...entries, entry] });
    setHigh("");
    setLow("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="hlc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "今日高低起伏"}
      </div>
      <div data-testid="hlc-count" className="text-xs text-center text-muted-foreground">
        已收到 {entries.length} 張卡片
      </div>

      {!myEntry && (
        <div data-testid="hlc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-emerald-600 mb-1">
              <TrendingUp className="w-3 h-3" />
              {cfg.highPrompt ?? "今天最高點是什麼？"}
            </label>
            <input
              data-testid="hlc-high-input"
              type="text"
              className="border rounded-lg px-3 py-2 text-sm w-full border-emerald-200 focus:border-emerald-400 outline-none"
              placeholder={cfg.highPlaceholder ?? "讓你最開心/最有成就感的事…"}
              maxLength={60}
              value={high}
              onChange={(e) => setHigh(e.target.value)}
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-rose-500 mb-1">
              <TrendingDown className="w-3 h-3" />
              {cfg.lowPrompt ?? "今天最低點是什麼？"}
            </label>
            <input
              data-testid="hlc-low-input"
              type="text"
              className="border rounded-lg px-3 py-2 text-sm w-full border-rose-200 focus:border-rose-400 outline-none"
              placeholder={cfg.lowPlaceholder ?? "讓你最有壓力/最挫折的事…"}
              maxLength={60}
              value={low}
              onChange={(e) => setLow(e.target.value)}
            />
          </div>
          <button
            data-testid="hlc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-gradient-to-r from-emerald-500 to-rose-400 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <BarChart2 className="w-4 h-4" />
            分享我的高低
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="hlc-my-entry" className="flex flex-col gap-2">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">最高點</span>
            </div>
            <p className="text-sm">{myEntry.high}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 border border-rose-200">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-semibold text-rose-600">最低點</span>
            </div>
            <p className="text-sm">{myEntry.low}</p>
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="hlc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-slate-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <BarChart2 className="w-4 h-4" />
          揭曉全隊高低
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="hlc-empty" className="text-center text-muted-foreground p-8">
          還沒有人填寫
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="hlc-result" className="flex flex-col gap-3">
          {entries.map((e) => (
            <div
              key={e.entryId}
              data-testid={`hlc-card-${e.entryId}`}
              className="rounded-xl border overflow-hidden"
            >
              <div className="bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {e.userName}
              </div>
              <div className="grid grid-cols-2 divide-x">
                <div className="p-3 bg-emerald-50">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-emerald-600">高</span>
                  </div>
                  <p className="text-xs leading-relaxed">{e.high}</p>
                </div>
                <div className="p-3 bg-rose-50">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingDown className="w-3 h-3 text-rose-500" />
                    <span className="text-xs text-rose-500">低</span>
                  </div>
                  <p className="text-xs leading-relaxed">{e.low}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
