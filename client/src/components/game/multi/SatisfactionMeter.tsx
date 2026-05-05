import { useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SatisfactionEntry {
  entryId: string;
  userId: string;
  userName: string;
  score: number;
  comment: string;
}

interface SatisfactionMeterState extends Record<string, unknown> {
  entries: SatisfactionEntry[];
  revealed: boolean;
}

interface SatisfactionMeterConfig {
  title: string;
  question: string;
  lowLabel: string;
  highLabel: string;
  commentPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): SatisfactionMeterConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "滿意度量表",
    question:
      typeof raw.question === "string"
        ? raw.question
        : "你有多大可能向朋友或同事推薦這次活動？（0 = 完全不會，10 = 非常會）",
    lowLabel: typeof raw.lowLabel === "string" ? raw.lowLabel : "完全不會",
    highLabel: typeof raw.highLabel === "string" ? raw.highLabel : "非常會",
    commentPlaceholder:
      typeof raw.commentPlaceholder === "string"
        ? raw.commentPlaceholder
        : "有什麼想說的嗎？（選填）",
  };
}

function getCategory(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

const CATEGORY_COLORS: Record<string, string> = {
  promoter: "bg-emerald-500",
  passive: "bg-amber-400",
  detractor: "bg-rose-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  promoter: "推薦者",
  passive: "被動者",
  detractor: "批評者",
};

const SCORE_COLORS = [
  "bg-rose-500",
  "bg-rose-400",
  "bg-orange-400",
  "bg-orange-300",
  "bg-amber-400",
  "bg-amber-300",
  "bg-yellow-300",
  "bg-lime-400",
  "bg-emerald-400",
  "bg-emerald-500",
  "bg-green-600",
];

const DEFAULT_STATE: SatisfactionMeterState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SatisfactionMeter({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SatisfactionMeterState>({
    gameId,
    sessionId,
    pageId,
    type: "satisfaction_meter",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="sm-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (selected === null) return;
    const entry: SatisfactionEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      score: selected,
      comment: comment.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function calcNPS() {
    const n = state.entries.length;
    if (n === 0) return null;
    const promoters = state.entries.filter((e) => getCategory(e.score) === "promoter").length;
    const detractors = state.entries.filter((e) => getCategory(e.score) === "detractor").length;
    return Math.round(((promoters - detractors) / n) * 100);
  }

  const nps = calcNPS();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-bold" data-testid="sm-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="sm-question">
        {cfg.question}
      </p>
      <p className="text-xs text-gray-400" data-testid="sm-count">
        已評分：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-4">
          <div className="space-y-2" data-testid="sm-scale">
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  data-testid={`sm-score-${i}`}
                  onClick={() => setSelected(i)}
                  className={`w-10 h-10 rounded text-sm font-bold transition-all ${
                    selected === i
                      ? `${SCORE_COLORS[i]} text-white shadow-md scale-110`
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{cfg.lowLabel}</span>
              <span>{cfg.highLabel}</span>
            </div>
          </div>
          <input
            data-testid="sm-comment-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.commentPlaceholder}
            maxLength={100}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            data-testid="sm-submit-btn"
            disabled={selected === null}
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-40 text-sm"
          >
            送出評分
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm"
          data-testid="sm-my-entry"
        >
          <p className="font-medium text-indigo-700">
            你的評分：{myEntry.score} / 10
            <span className="ml-2 text-xs">
              （{CATEGORY_LABELS[getCategory(myEntry.score)]}）
            </span>
          </p>
          {myEntry.comment && (
            <p className="text-gray-600 mt-1 text-xs">「{myEntry.comment}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="sm-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="sm-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📊 滿意度結果</p>
          {state.entries.length === 0 ? (
            <p data-testid="sm-empty" className="text-gray-400 text-sm">
              尚無資料
            </p>
          ) : (
            <div className="space-y-3">
              {nps !== null && (
                <div
                  data-testid="sm-nps"
                  className={`text-center p-3 rounded-lg text-white font-bold text-xl ${
                    nps >= 50 ? "bg-emerald-500" : nps >= 0 ? "bg-amber-400" : "bg-rose-400"
                  }`}
                >
                  NPS {nps > 0 ? "+" : ""}{nps}
                </div>
              )}
              <div className="flex gap-2">
                {(["promoter", "passive", "detractor"] as const).map((cat) => {
                  const count = state.entries.filter(
                    (e) => getCategory(e.score) === cat
                  ).length;
                  return (
                    <div
                      key={cat}
                      data-testid={`sm-cat-${cat}`}
                      className={`flex-1 text-center p-2 rounded text-white text-xs ${CATEGORY_COLORS[cat]}`}
                    >
                      <p className="font-bold text-lg">{count}</p>
                      <p>{CATEGORY_LABELS[cat]}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1">
                {state.entries.filter((e) => e.comment).map((entry) => (
                  <div
                    key={entry.entryId}
                    data-testid={`sm-card-${entry.entryId}`}
                    className="text-xs text-gray-600 bg-gray-50 rounded p-2 border"
                  >
                    <span className="font-medium">{entry.userName}</span>{" "}
                    <span className="text-gray-400">({entry.score})</span>：
                    {entry.comment}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SatisfactionMeter;
