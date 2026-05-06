import { useState } from "react";
import { Map, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ChallengeEntry {
  entryId: string;
  userId: string;
  userName: string;
  challenge: string;
  category: string;
  severity: "high" | "medium" | "low";
}

interface ChallengeMapState extends Record<string, unknown> {
  entries: ChallengeEntry[];
  revealed: boolean;
}

interface ChallengeMapConfig {
  title: string;
  prompt: string;
  placeholder: string;
}

function extractConfig(raw: Record<string, unknown>): ChallengeMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "挑戰地圖",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "你目前面對的最大挑戰是什麼？",
    placeholder:
      typeof raw.placeholder === "string"
        ? raw.placeholder
        : "描述你的挑戰…（≥5字）",
  };
}

const DEFAULT_STATE: ChallengeMapState = { entries: [], revealed: false };

const CATEGORIES = [
  { id: "skill", label: "技能缺口", emoji: "🎯" },
  { id: "resource", label: "資源不足", emoji: "💰" },
  { id: "time", label: "時間壓力", emoji: "⏰" },
  { id: "communication", label: "溝通困難", emoji: "💬" },
  { id: "motivation", label: "動力低落", emoji: "🔋" },
  { id: "clarity", label: "方向不明", emoji: "🧭" },
] as const;

const SEVERITY_CONFIG = {
  high: { label: "嚴重", color: "bg-red-500", ring: "ring-red-400", text: "text-red-600" },
  medium: { label: "中等", color: "bg-amber-400", ring: "ring-amber-400", text: "text-amber-600" },
  low: { label: "輕微", color: "bg-green-400", ring: "ring-green-400", text: "text-green-600" },
} as const;

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ChallengeMap({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ChallengeMapState>({
    gameId,
    sessionId,
    pageId,
    type: "challenge_map",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [challenge, setChallenge] = useState("");
  const [category, setCategory] = useState("skill");
  const [severity, setSeverity] = useState<"high" | "medium" | "low">("medium");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="cm-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = challenge.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: ChallengeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      challenge: challenge.trim(),
      category,
      severity,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function categoryStats() {
    const map: Record<string, number> = {};
    state.entries.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + 1;
    });
    return map;
  }

  const stats = state.revealed ? categoryStats() : {};

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Map className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-bold" data-testid="cm-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="cm-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="cm-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry ? (
        <div className="space-y-3" data-testid="cm-form">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">挑戰類別</p>
            <div data-testid="cm-categories" className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  data-testid={`cm-cat-${cat.id}`}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    category === cat.id
                      ? "border-orange-400 bg-orange-50 text-orange-700 font-medium"
                      : "border-gray-200 text-gray-500 hover:border-orange-200"
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">嚴重程度</p>
            <div data-testid="cm-severity" className="flex gap-2">
              {(["high", "medium", "low"] as const).map((sev) => (
                <button
                  key={sev}
                  data-testid={`cm-sev-${sev}`}
                  onClick={() => setSeverity(sev)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    severity === sev
                      ? `${SEVERITY_CONFIG[sev].color} text-white border-transparent`
                      : `border-gray-200 text-gray-500`
                  }`}
                >
                  {SEVERITY_CONFIG[sev].label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            data-testid="cm-challenge-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={3}
            placeholder={cfg.placeholder}
            maxLength={100}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
          />

          <button
            data-testid="cm-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-40 text-sm"
          >
            標記挑戰
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-orange-50 rounded border border-orange-200 text-sm"
          data-testid="cm-my-entry"
        >
          <p className="text-xs text-orange-700 font-medium mb-1">你的挑戰</p>
          <p className="text-xs text-gray-600">{myEntry.challenge}</p>
          <div className="flex gap-2 mt-1">
            <span className="text-xs text-gray-400">
              {CATEGORIES.find((c) => c.id === myEntry.category)?.emoji}{" "}
              {CATEGORIES.find((c) => c.id === myEntry.category)?.label}
            </span>
            <span className={`text-xs font-medium ${SEVERITY_CONFIG[myEntry.severity].text}`}>
              {SEVERITY_CONFIG[myEntry.severity].label}
            </span>
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="cm-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊挑戰
        </button>
      )}

      {state.revealed && (
        <div data-testid="cm-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🗺️ 全隊挑戰地圖</p>
          {state.entries.length === 0 ? (
            <p data-testid="cm-empty" className="text-gray-400 text-sm">尚無提交</p>
          ) : (
            <>
              <div data-testid="cm-category-stats" className="flex flex-wrap gap-2">
                {CATEGORIES.filter((cat) => (stats[cat.id] ?? 0) > 0).map((cat) => (
                  <span
                    key={cat.id}
                    className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded"
                  >
                    {cat.emoji} {cat.label} ×{stats[cat.id]}
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                {state.entries.map((entry) => (
                  <div
                    key={entry.entryId}
                    data-testid={`cm-card-${entry.entryId}`}
                    className="p-2 bg-white border rounded shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_CONFIG[entry.severity].color}`} />
                      <span className="text-xs font-medium text-gray-700">{entry.userName}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {CATEGORIES.find((c) => c.id === entry.category)?.emoji}
                        {CATEGORIES.find((c) => c.id === entry.category)?.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 pl-4">{entry.challenge}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ChallengeMap;
