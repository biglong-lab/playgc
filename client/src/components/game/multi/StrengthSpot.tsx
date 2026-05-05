import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StrengthEntry {
  entryId: string;
  userId: string;
  userName: string;
  strength: string;
  description: string;
}

interface StrengthSpotState extends Record<string, unknown> {
  entries: StrengthEntry[];
  revealed: boolean;
}

interface StrengthSpotConfig {
  title: string;
  prompt: string;
  strengthPlaceholder: string;
  descPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): StrengthSpotConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "優勢聚焦",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "你帶給這個團隊最獨特的優勢或貢獻是什麼？",
    strengthPlaceholder: typeof raw.strengthPlaceholder === "string"
      ? raw.strengthPlaceholder
      : "我的優勢（如：創意發想、邏輯分析...）",
    descPlaceholder: typeof raw.descPlaceholder === "string"
      ? raw.descPlaceholder
      : "簡短說明（選填）",
  };
}

const STRENGTH_COLORS = [
  "from-amber-400 to-orange-400",
  "from-emerald-400 to-teal-400",
  "from-sky-400 to-blue-400",
  "from-violet-400 to-purple-400",
  "from-rose-400 to-pink-400",
  "from-lime-400 to-green-400",
  "from-cyan-400 to-sky-400",
  "from-fuchsia-400 to-violet-400",
];

const DEFAULT_STATE: StrengthSpotState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StrengthSpot({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<StrengthSpotState>({
    gameId,
    sessionId,
    pageId,
    type: "strength_spot",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [strength, setStrength] = useState("");
  const [description, setDescription] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ss-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!strength.trim()) return;
    const entry: StrengthEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      strength: strength.trim(),
      description: description.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function gradientFor(i: number) {
    return STRENGTH_COLORS[i % STRENGTH_COLORS.length];
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
        <h2 className="text-xl font-bold" data-testid="ss-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ss-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="ss-count">已分享：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <input
            data-testid="ss-strength-input"
            className="w-full border rounded p-2 text-sm font-medium"
            placeholder={cfg.strengthPlaceholder}
            maxLength={30}
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
          />
          <input
            data-testid="ss-desc-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.descPlaceholder}
            maxLength={80}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            data-testid="ss-submit-btn"
            disabled={!strength.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-40 text-sm"
          >
            分享我的優勢
          </button>
        </div>
      ) : (
        <div className="p-3 bg-amber-50 rounded border border-amber-200 text-sm space-y-1" data-testid="ss-my-entry">
          <p className="font-semibold text-amber-700">⭐ {myEntry.strength}</p>
          {myEntry.description && <p className="text-gray-600 text-xs">{myEntry.description}</p>}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ss-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊優勢地圖
        </button>
      )}

      {state.revealed && (
        <div data-testid="ss-result" className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">團隊優勢全景</p>
          {state.entries.length === 0 ? (
            <p data-testid="ss-empty" className="text-gray-400 text-sm">尚無資料</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`ss-card-${entry.entryId}`}
                  className={`rounded-xl p-3 bg-gradient-to-br ${gradientFor(i)} text-white shadow-sm`}
                >
                  <p className="text-sm font-bold">{entry.strength}</p>
                  <p className="text-xs opacity-90 mt-0.5">{entry.userName}</p>
                  {entry.description && (
                    <p className="text-xs opacity-75 mt-1">{entry.description}</p>
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

export default StrengthSpot;
