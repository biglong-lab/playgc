import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SpotEntry {
  entryId: string;
  userId: string;
  userName: string;
  blindSpot: string;
  selfAware: string;
  action: string;
}

interface BlindSpotState extends Record<string, unknown> {
  entries: SpotEntry[];
  revealed: boolean;
}

interface BlindSpotConfig {
  title: string;
  prompt: string;
  blindPlaceholder: string;
  selfPlaceholder: string;
  actionPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): BlindSpotConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "盲點揭示",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "你的一個可能影響表現的盲點或習慣是什麼？",
    blindPlaceholder:
      typeof raw.blindPlaceholder === "string"
        ? raw.blindPlaceholder
        : "我的盲點是…（≥5字）",
    selfPlaceholder:
      typeof raw.selfPlaceholder === "string"
        ? raw.selfPlaceholder
        : "我曾經這樣自我欺騙… 或 別人怎麼看我（選填）",
    actionPlaceholder:
      typeof raw.actionPlaceholder === "string"
        ? raw.actionPlaceholder
        : "我打算怎麼改善？（選填）",
  };
}

const DEFAULT_STATE: BlindSpotState = { entries: [], revealed: false };

const AWARENESS_LEVELS = [
  { id: "none", label: "剛意識到", color: "bg-red-100 text-red-700" },
  { id: "some", label: "努力改善中", color: "bg-amber-100 text-amber-700" },
  { id: "growing", label: "逐漸突破", color: "bg-green-100 text-green-700" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function BlindSpot({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<BlindSpotState>({
    gameId,
    sessionId,
    pageId,
    type: "blind_spot",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [blindSpot, setBlindSpot] = useState("");
  const [selfAware, setSelfAware] = useState("");
  const [action, setAction] = useState("");
  const [awareness, setAwareness] = useState(AWARENESS_LEVELS[0]?.id ?? "none");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="bs-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = blindSpot.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: SpotEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      blindSpot: blindSpot.trim(),
      selfAware: selfAware.trim(),
      action: action.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const awarenessLevel = AWARENESS_LEVELS.find((l) => l.id === awareness);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5 text-indigo-500" />
        <h2 className="text-xl font-bold" data-testid="bs-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="bs-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="bs-count">
        已揭示：{state.entries.length} 個盲點
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="bs-form">
          <div>
            <p className="text-xs text-gray-500 mb-1">目前意識程度</p>
            <div className="flex gap-2" data-testid="bs-awareness-picker">
              {AWARENESS_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  data-testid={`bs-awareness-${lvl.id}`}
                  onClick={() => setAwareness(lvl.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-all border ${
                    awareness === lvl.id
                      ? "border-indigo-400 " + lvl.color
                      : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            data-testid="bs-blind-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={3}
            placeholder={cfg.blindPlaceholder}
            maxLength={100}
            value={blindSpot}
            onChange={(e) => setBlindSpot(e.target.value)}
          />

          <textarea
            data-testid="bs-self-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={cfg.selfPlaceholder}
            maxLength={80}
            value={selfAware}
            onChange={(e) => setSelfAware(e.target.value)}
          />

          <input
            data-testid="bs-action-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.actionPlaceholder}
            maxLength={60}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />

          <button
            data-testid="bs-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-40 text-sm"
          >
            勇敢揭示
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm space-y-1"
          data-testid="bs-my-entry"
        >
          <span className={`text-xs px-2 py-0.5 rounded-full ${awarenessLevel?.color ?? "bg-gray-100"}`}>
            {awarenessLevel?.label}
          </span>
          <p className="font-medium text-gray-800 mt-1">👁 {myEntry.blindSpot}</p>
          {myEntry.action && (
            <p className="text-xs text-indigo-600">→ {myEntry.action}</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="bs-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊盲點
        </button>
      )}

      {state.revealed && (
        <div data-testid="bs-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">👁 全隊盲點揭示</p>
          {state.entries.length === 0 ? (
            <p data-testid="bs-empty" className="text-gray-400 text-sm">
              尚無揭示
            </p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`bs-card-${entry.entryId}`}
                  className="p-3 bg-white border-l-4 border-indigo-300 rounded-r shadow-sm"
                >
                  <p className="text-xs text-gray-400">{entry.userName}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{entry.blindSpot}</p>
                  {entry.selfAware && (
                    <p className="text-xs text-gray-500 italic mt-0.5">「{entry.selfAware}」</p>
                  )}
                  {entry.action && (
                    <p className="text-xs text-indigo-600 mt-0.5">→ {entry.action}</p>
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

export default BlindSpot;
