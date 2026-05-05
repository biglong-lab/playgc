import { useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ReflectionEntry {
  entryId: string;
  userId: string;
  userName: string;
  worked: string;
  improve: string;
  action: string;
}

interface ReflectionCardState extends Record<string, unknown> {
  entries: ReflectionEntry[];
  revealed: boolean;
}

interface ReflectionCardConfig {
  title: string;
  workedLabel: string;
  improveLabel: string;
  actionLabel: string;
  workedPlaceholder: string;
  improvePlaceholder: string;
  actionPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): ReflectionCardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "回顧反思",
    workedLabel: typeof raw.workedLabel === "string" ? raw.workedLabel : "✅ 做得好的地方",
    improveLabel: typeof raw.improveLabel === "string" ? raw.improveLabel : "💡 可以改善的地方",
    actionLabel: typeof raw.actionLabel === "string" ? raw.actionLabel : "🚀 下一步行動",
    workedPlaceholder: typeof raw.workedPlaceholder === "string" ? raw.workedPlaceholder : "這次做得不錯的是...",
    improvePlaceholder: typeof raw.improvePlaceholder === "string" ? raw.improvePlaceholder : "如果重來，我會...",
    actionPlaceholder: typeof raw.actionPlaceholder === "string" ? raw.actionPlaceholder : "我接下來要做的是...",
  };
}

const DEFAULT_STATE: ReflectionCardState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ReflectionCard({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ReflectionCardState>({
    gameId,
    sessionId,
    pageId,
    type: "reflection_card",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [worked, setWorked] = useState("");
  const [improve, setImprove] = useState("");
  const [action, setAction] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="rc-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = worked.trim().length > 0 || improve.trim().length > 0 || action.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: ReflectionEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      worked: worked.trim(),
      improve: improve.trim(),
      action: action.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <h2 className="text-xl font-bold" data-testid="rc-title">{cfg.title}</h2>
      </div>
      <p className="text-xs text-gray-400" data-testid="rc-count">已回顧：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-green-700 block mb-1" data-testid="rc-worked-label">
              {cfg.workedLabel}
            </label>
            <textarea
              data-testid="rc-worked-input"
              className="w-full border border-green-200 rounded p-2 text-sm resize-none h-16"
              placeholder={cfg.workedPlaceholder}
              maxLength={100}
              value={worked}
              onChange={(e) => setWorked(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-amber-700 block mb-1" data-testid="rc-improve-label">
              {cfg.improveLabel}
            </label>
            <textarea
              data-testid="rc-improve-input"
              className="w-full border border-amber-200 rounded p-2 text-sm resize-none h-16"
              placeholder={cfg.improvePlaceholder}
              maxLength={100}
              value={improve}
              onChange={(e) => setImprove(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-blue-700 block mb-1" data-testid="rc-action-label">
              {cfg.actionLabel}
            </label>
            <textarea
              data-testid="rc-action-input"
              className="w-full border border-blue-200 rounded p-2 text-sm resize-none h-16"
              placeholder={cfg.actionPlaceholder}
              maxLength={100}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <button
            data-testid="rc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出回顧
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-3 bg-yellow-50 rounded border border-yellow-200 text-sm" data-testid="rc-my-entry">
          {myEntry.worked && (
            <p><span className="text-green-700 font-medium text-xs">✅</span> {myEntry.worked}</p>
          )}
          {myEntry.improve && (
            <p><span className="text-amber-700 font-medium text-xs">💡</span> {myEntry.improve}</p>
          )}
          {myEntry.action && (
            <p><span className="text-blue-700 font-medium text-xs">🚀</span> {myEntry.action}</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="rc-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊回顧
        </button>
      )}

      {state.revealed && (
        <div data-testid="rc-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">全隊回顧牆</p>
          {state.entries.length === 0 ? (
            <p data-testid="rc-empty" className="text-gray-400 text-sm">尚無回顧</p>
          ) : (
            <div className="space-y-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`rc-card-${entry.entryId}`}
                  className="bg-white border rounded-lg p-3 space-y-1.5 shadow-sm"
                >
                  <p className="text-xs text-gray-500 font-semibold">{entry.userName}</p>
                  {entry.worked && (
                    <p className="text-sm"><span className="text-green-600">✅ </span>{entry.worked}</p>
                  )}
                  {entry.improve && (
                    <p className="text-sm"><span className="text-amber-600">💡 </span>{entry.improve}</p>
                  )}
                  {entry.action && (
                    <p className="text-sm"><span className="text-blue-600">🚀 </span>{entry.action}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReflectionCard;
