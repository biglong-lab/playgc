import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SafetyDimension {
  id: string;
  label: string;
}

interface SafetyEntry {
  entryId: string;
  userId: string;
  userName: string;
  scores: Record<string, number>;
}

interface SafetyCheckState extends Record<string, unknown> {
  entries: SafetyEntry[];
  revealed: boolean;
}

interface SafetyCheckConfig {
  title: string;
  prompt: string;
  dimensions: SafetyDimension[];
}

const DEFAULT_DIMS: SafetyDimension[] = [
  { id: "speak_up", label: "我敢說出真實想法" },
  { id: "feedback", label: "我能坦然接受反饋" },
  { id: "try_new", label: "我勇於嘗試新方法" },
  { id: "trust", label: "我信任夥伴" },
];

function extractConfig(raw: Record<string, unknown>): SafetyCheckConfig {
  const dims = Array.isArray(raw.dimensions)
    ? (raw.dimensions as SafetyDimension[])
    : DEFAULT_DIMS;
  return {
    title: typeof raw.title === "string" ? raw.title : "心理安全感",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "在以下四個維度，評估你目前在這個團隊中的感受（1=非常低，5=非常高）",
    dimensions: dims,
  };
}

const SCORE_LABELS = ["", "非常低", "偏低", "普通", "偏高", "非常高"];

const DEFAULT_STATE: SafetyCheckState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SafetyCheck({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SafetyCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "safety_check",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();

  const cfg = extractConfig(rawConfig);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(cfg.dimensions.map((d) => [d.id, 0]))
  );

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="sc-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = cfg.dimensions.every((d) => (scores[d.id] ?? 0) > 0);

  function handleScore(dimId: string, val: number) {
    setScores((prev) => ({ ...prev, [dimId]: val }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: SafetyEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      scores: { ...scores },
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function avgFor(dimId: string) {
    if (state.entries.length === 0) return 0;
    const sum = state.entries.reduce((s, e) => s + ((e.scores[dimId] as number) ?? 0), 0);
    return sum / state.entries.length;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold" data-testid="sc-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="sc-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="sc-count">
        已完成：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="sc-form">
          {cfg.dimensions.map((dim) => (
            <div key={dim.id}>
              <p className="text-sm font-medium text-gray-700 mb-2" data-testid={`sc-dim-label-${dim.id}`}>
                {dim.label}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    data-testid={`sc-score-${dim.id}-${v}`}
                    onClick={() => handleScore(dim.id, v)}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      scores[dim.id] === v
                        ? "bg-blue-600 text-white shadow-md scale-110"
                        : "bg-gray-100 text-gray-600 hover:bg-blue-100"
                    }`}
                  >
                    {v}
                  </button>
                ))}
                <span className="text-xs text-gray-400 self-center ml-1">
                  {scores[dim.id] ? SCORE_LABELS[scores[dim.id]] : "—"}
                </span>
              </div>
            </div>
          ))}
          <button
            data-testid="sc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-40 text-sm"
          >
            送出評估
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-blue-50 rounded border border-blue-200 text-sm space-y-1"
          data-testid="sc-my-entry"
        >
          {cfg.dimensions.map((d) => (
            <p key={d.id} className="text-gray-700 text-xs">
              {d.label}：{"★".repeat(myEntry.scores[d.id] ?? 0)}
            </p>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="sc-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="sc-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🛡️ 全隊心理安全感指數</p>
          {state.entries.length === 0 ? (
            <p data-testid="sc-empty" className="text-gray-400 text-sm">
              尚無資料
            </p>
          ) : (
            <div className="space-y-3">
              {cfg.dimensions.map((dim) => {
                const avg = avgFor(dim.id);
                const pct = Math.round((avg / 5) * 100);
                return (
                  <div key={dim.id} data-testid={`sc-bar-${dim.id}`}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{dim.label}</span>
                      <span className="font-medium">{avg.toFixed(1)} / 5</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SafetyCheck;
