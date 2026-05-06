import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ActionEntry {
  entryId: string;
  userId: string;
  userName: string;
  action: string;
  deadline: string;
  support: string;
}

interface ActionPlanState extends Record<string, unknown> {
  entries: ActionEntry[];
  revealed: boolean;
}

interface ActionPlanConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): ActionPlanConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "行動計畫",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "完成這個活動後，你打算採取的第一個具體行動是什麼？",
  };
}

const DEFAULT_STATE: ActionPlanState = { entries: [], revealed: false };

const DEADLINE_OPTIONS = [
  "今天",
  "本週內",
  "兩週內",
  "本月底",
  "下次聚會前",
  "下季度前",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ActionPlan({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ActionPlanState>({
    gameId,
    sessionId,
    pageId,
    type: "action_plan",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [action, setAction] = useState("");
  const [deadline, setDeadline] = useState("本週內");
  const [support, setSupport] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ap-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = action.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: ActionEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      action: action.trim(),
      deadline,
      support: support.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-violet-600" />
        <h2 className="text-xl font-bold" data-testid="ap-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ap-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ap-count">
        已承諾：{state.entries.length} 個行動
      </p>

      {!myEntry ? (
        <div className="space-y-3" data-testid="ap-form">
          <div>
            <label className="text-xs font-medium text-violet-700 block mb-1">
              行動（≥5字）
            </label>
            <textarea
              data-testid="ap-action-input"
              className="w-full border rounded p-2 text-sm resize-none"
              rows={3}
              placeholder="我具體要做的事情是…"
              maxLength={100}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              截止時間
            </label>
            <div data-testid="ap-deadline-picker" className="flex flex-wrap gap-2">
              {DEADLINE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  data-testid={`ap-deadline-${opt}`}
                  onClick={() => setDeadline(opt)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    deadline === opt
                      ? "border-violet-500 bg-violet-50 text-violet-700 font-medium"
                      : "border-gray-200 text-gray-500 hover:border-violet-200"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              需要的支援（選填）
            </label>
            <input
              data-testid="ap-support-input"
              className="w-full border rounded p-2 text-sm"
              placeholder="希望隊友或誰給我什麼幫助？"
              maxLength={60}
              value={support}
              onChange={(e) => setSupport(e.target.value)}
            />
          </div>

          <button
            data-testid="ap-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-violet-600 text-white rounded disabled:opacity-40 text-sm"
          >
            承諾行動
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-violet-50 rounded border border-violet-200 text-sm"
          data-testid="ap-my-entry"
        >
          <p className="text-xs text-violet-700 font-medium mb-1">你的行動承諾</p>
          <p className="text-xs text-gray-700">{myEntry.action}</p>
          <p className="text-xs text-gray-400 mt-0.5">⏰ {myEntry.deadline}</p>
          {myEntry.support && (
            <p className="text-xs text-gray-400 mt-0.5">🤝 {myEntry.support}</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ap-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊行動
        </button>
      )}

      {state.revealed && (
        <div data-testid="ap-result" className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">✅ 全隊行動清單</p>
          {state.entries.length === 0 ? (
            <p data-testid="ap-empty" className="text-gray-400 text-sm">尚無承諾</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`ap-card-${entry.entryId}`}
                className="p-3 bg-violet-50 border border-violet-200 rounded"
              >
                <div className="flex items-start gap-2">
                  <span className="text-violet-600 font-bold text-sm w-5 flex-shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700">{entry.userName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{entry.action}</p>
                    <p className="text-xs text-gray-400 mt-0.5">⏰ {entry.deadline}</p>
                    {entry.support && (
                      <p className="text-xs text-gray-400">🤝 需要：{entry.support}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ActionPlan;
