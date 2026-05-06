import { useState } from "react";
import { Loader2, Radar } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RadarEntry {
  entryId: string;
  userId: string;
  userName: string;
  scores: Record<string, number>;
}

interface TeamRadarState extends Record<string, unknown> {
  entries: RadarEntry[];
  revealed: boolean;
}

interface TeamRadarConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): TeamRadarConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "團隊雷達",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "為你的團隊在 5 個面向打分（1-5 分）",
  };
}

const DIMENSIONS = [
  { id: "effectiveness", label: "成效", emoji: "🎯", color: "text-blue-600" },
  { id: "communication", label: "溝通", emoji: "💬", color: "text-green-600" },
  { id: "trust", label: "信任", emoji: "🤝", color: "text-purple-600" },
  { id: "energy", label: "活力", emoji: "⚡", color: "text-yellow-600" },
  { id: "innovation", label: "創新", emoji: "💡", color: "text-rose-600" },
];

const SCORE_LABELS = ["", "有待加強", "需要努力", "還不錯", "頗為良好", "非常出色"];

const DEFAULT_STATE: TeamRadarState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamRadar({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamRadarState>({
    gameId,
    sessionId,
    pageId,
    type: "team_radar",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const initialScores = Object.fromEntries(DIMENSIONS.map((d) => [d.id, 0]));
  const [scores, setScores] = useState<Record<string, number>>(initialScores);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tr-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = DIMENSIONS.every((d) => scores[d.id] > 0);

  function handleScore(dimId: string, val: number) {
    setScores((prev) => ({ ...prev, [dimId]: val }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: RadarEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      scores: { ...scores },
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setScores(initialScores);
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function avgScore(dimId: string) {
    if (state.entries.length === 0) return 0;
    const sum = state.entries.reduce((a, e) => a + (e.scores[dimId] ?? 0), 0);
    return sum / state.entries.length;
  }

  const total = state.entries.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="w-5 h-5 text-blue-500" />
        <h2 className="text-xl font-bold" data-testid="tr-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tr-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="tr-count">
        已評分：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="tr-form" className="space-y-4">
          {DIMENSIONS.map((d) => (
            <div key={d.id} data-testid={`tr-dim-${d.id}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium ${d.color}`}>
                  {d.emoji} {d.label}
                </span>
                {scores[d.id] > 0 && (
                  <span className="text-xs text-gray-400">
                    {scores[d.id]} — {SCORE_LABELS[scores[d.id]]}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    data-testid={`tr-score-${d.id}-${v}`}
                    onClick={() => handleScore(d.id, v)}
                    className={`flex-1 h-8 rounded text-sm font-bold transition-all ${
                      scores[d.id] === v
                        ? "bg-blue-500 text-white scale-105"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            data-testid="tr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出評分
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-blue-50 rounded border border-blue-200 text-sm space-y-1"
          data-testid="tr-my-entry"
        >
          <p className="text-xs text-blue-700 font-medium">你的評分已送出</p>
          {DIMENSIONS.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                {d.emoji} {d.label}
              </span>
              <span className="font-bold text-blue-700">
                {myEntry.scores[d.id]} / 5
              </span>
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tr-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
        >
          揭示全隊評分
        </button>
      )}

      {state.revealed && (
        <div data-testid="tr-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">
            📡 全隊平均雷達分數
          </p>
          {total === 0 ? (
            <p data-testid="tr-empty" className="text-gray-400 text-sm">
              尚無評分
            </p>
          ) : (
            <>
              <div data-testid="tr-avg-scores" className="space-y-2">
                {DIMENSIONS.map((d) => {
                  const avg = avgScore(d.id);
                  const pct = (avg / 5) * 100;
                  return (
                    <div
                      key={d.id}
                      data-testid={`tr-avg-${d.id}`}
                      className="space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${d.color}`}>
                          {d.emoji} {d.label}
                        </span>
                        <span className="text-gray-500">
                          {avg.toFixed(1)} / 5
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div data-testid="tr-member-list" className="space-y-1 pt-2 border-t">
                {state.entries.map((e) => (
                  <div
                    key={e.entryId}
                    data-testid={`tr-card-${e.entryId}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-600">{e.userName}</span>
                    <div className="flex gap-1 text-gray-400">
                      {DIMENSIONS.map((d) => (
                        <span key={d.id}>
                          {d.emoji}
                          {e.scores[d.id]}
                        </span>
                      ))}
                    </div>
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

export default TeamRadar;
