import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ObjectiveEntry {
  entryId: string;
  userId: string;
  userName: string;
  objective: string;
  status: "pending" | "achieved" | "partial";
}

interface LearningObjectiveState extends Record<string, unknown> {
  entries: ObjectiveEntry[];
  revealed: boolean;
}

interface LearningObjectiveConfig {
  title: string;
  prompt: string;
  placeholder: string;
}

function extractConfig(raw: Record<string, unknown>): LearningObjectiveConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "學習目標",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "在這次活動中，你最想達成的一個學習目標是什麼？",
    placeholder:
      typeof raw.placeholder === "string"
        ? raw.placeholder
        : "我想要學會 / 理解 / 體驗...",
  };
}

const STATUS_CONFIG = {
  pending: { label: "進行中", color: "bg-gray-100 text-gray-600 border-gray-200" },
  achieved: { label: "已達成 ✅", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  partial: { label: "部分達成 🌱", color: "bg-amber-100 text-amber-700 border-amber-200" },
};

const CARD_COLORS = [
  "border-l-4 border-l-sky-400 bg-sky-50",
  "border-l-4 border-l-violet-400 bg-violet-50",
  "border-l-4 border-l-rose-400 bg-rose-50",
  "border-l-4 border-l-emerald-400 bg-emerald-50",
  "border-l-4 border-l-amber-400 bg-amber-50",
];

const DEFAULT_STATE: LearningObjectiveState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LearningObjective({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<LearningObjectiveState>({
    gameId,
    sessionId,
    pageId,
    type: "learning_objective",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [objective, setObjective] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="lo-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = objective.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: ObjectiveEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      objective: objective.trim(),
      status: "pending",
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function updateMyStatus(status: ObjectiveEntry["status"]) {
    const updated = state.entries.map((e) =>
      e.userId === userId ? { ...e, status } : e
    );
    updateState({ ...state, entries: updated });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-sky-600" />
        <h2 className="text-xl font-bold" data-testid="lo-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="lo-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="lo-count">
        已設定目標：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-3">
          <textarea
            data-testid="lo-input"
            className="w-full border border-sky-200 rounded p-2 text-sm resize-none h-20"
            placeholder={cfg.placeholder}
            maxLength={120}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
          <button
            data-testid="lo-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-sky-600 text-white rounded disabled:opacity-40 text-sm"
          >
            設定目標
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-sky-50 rounded border border-sky-200 text-sm space-y-2"
          data-testid="lo-my-entry"
        >
          <p className="text-gray-700 italic">「{myEntry.objective}」</p>
          {state.revealed && (
            <div className="flex gap-2 flex-wrap" data-testid="lo-status-actions">
              {(["achieved", "partial", "pending"] as const).map((s) => (
                <button
                  key={s}
                  data-testid={`lo-status-${s}`}
                  onClick={() => updateMyStatus(s)}
                  className={`px-2 py-1 rounded border text-xs ${
                    myEntry.status === s
                      ? STATUS_CONFIG[s].color + " font-semibold"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="lo-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊目標
        </button>
      )}

      {state.revealed && (
        <div data-testid="lo-result" className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">📚 全隊學習目標</p>
          {state.entries.length === 0 ? (
            <p data-testid="lo-empty" className="text-gray-400 text-sm">
              尚無目標
            </p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`lo-card-${entry.entryId}`}
                  className={`rounded-r pl-3 py-2 pr-2 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{entry.userName}</p>
                      <p className="text-sm text-gray-700 mt-0.5 italic">
                        「{entry.objective}」
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded border text-xs ${STATUS_CONFIG[entry.status].color}`}
                    >
                      {STATUS_CONFIG[entry.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LearningObjective;
