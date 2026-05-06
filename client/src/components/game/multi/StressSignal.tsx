import { useState } from "react";
import { Loader2, Activity } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SignalEntry {
  entryId: string;
  userId: string;
  userName: string;
  level: number;
  stressor: string;
  note: string;
}

interface StressSignalState extends Record<string, unknown> {
  entries: SignalEntry[];
  revealed: boolean;
}

interface StressSignalConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): StressSignalConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "壓力信號",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "現在的你，壓力狀態如何？主要來自哪裡？",
  };
}

const LEVELS = [
  { value: 1, label: "完全放鬆", emoji: "😌", color: "bg-green-100 border-green-400 text-green-800", bar: "bg-green-400" },
  { value: 2, label: "輕微緊繃", emoji: "🙂", color: "bg-lime-100 border-lime-400 text-lime-800", bar: "bg-lime-400" },
  { value: 3, label: "中度壓力", emoji: "😐", color: "bg-yellow-100 border-yellow-400 text-yellow-800", bar: "bg-yellow-400" },
  { value: 4, label: "高度壓力", emoji: "😰", color: "bg-orange-100 border-orange-400 text-orange-800", bar: "bg-orange-400" },
  { value: 5, label: "快要爆炸", emoji: "🤯", color: "bg-red-100 border-red-400 text-red-800", bar: "bg-red-400" },
] as const;

const STRESSORS = ["工作量", "人際關係", "時間壓力", "不確定性", "資源不足", "技術挑戰", "溝通摩擦", "個人生活"];

const DEFAULT_STATE: StressSignalState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StressSignal({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<StressSignalState>({
    gameId,
    sessionId,
    pageId,
    type: "stress_signal",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [level, setLevel] = useState<number>(0);
  const [stressor, setStressor] = useState("");
  const [note, setNote] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ss-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = level > 0 && stressor !== "";

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: SignalEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      level,
      stressor,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setLevel(0);
    setStressor("");
    setNote("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function getLevelDef(v: number) {
    return LEVELS.find((l) => l.value === v);
  }

  function avgLevel() {
    if (state.entries.length === 0) return 0;
    const sum = state.entries.reduce((a, e) => a + e.level, 0);
    return (sum / state.entries.length).toFixed(1);
  }

  const total = state.entries.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-bold" data-testid="ss-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ss-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ss-count">
        已回報：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="ss-form" className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">壓力等級</p>
            <div data-testid="ss-level-picker" className="grid grid-cols-5 gap-1">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  data-testid={`ss-level-${l.value}`}
                  onClick={() => setLevel(l.value)}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${
                    level === l.value
                      ? l.color + " scale-105 font-bold"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-lg">{l.emoji}</div>
                  <div className="text-[10px] mt-0.5 leading-tight">{l.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">主要壓力來源</p>
            <div data-testid="ss-stressor-picker" className="grid grid-cols-2 gap-1.5">
              {STRESSORS.map((s) => (
                <button
                  key={s}
                  data-testid={`ss-stressor-${s}`}
                  onClick={() => setStressor(s)}
                  className={`px-2 py-1.5 rounded border text-xs transition-all ${
                    stressor === s
                      ? "bg-orange-500 border-orange-500 text-white font-bold"
                      : "border-gray-200 text-gray-700 hover:border-orange-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              補充說明（選填）
            </label>
            <input
              data-testid="ss-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可以說說更多..."
              className="w-full p-2 border rounded text-sm"
            />
          </div>

          <button
            data-testid="ss-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-orange-500 text-white rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出壓力信號
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-orange-50 rounded border border-orange-200 text-sm space-y-1"
          data-testid="ss-my-entry"
        >
          {(() => {
            const l = getLevelDef(myEntry.level);
            return (
              <>
                <p className="text-xs text-orange-700 font-medium">你的壓力信號已送出</p>
                <p className="font-bold text-orange-900">
                  {l?.emoji} {l?.label}（等級 {myEntry.level}）
                </p>
                <p className="text-xs text-orange-600">主因：{myEntry.stressor}</p>
              </>
            );
          })()}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ss-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-orange-500 text-white rounded text-sm"
        >
          揭示全隊壓力信號
        </button>
      )}

      {state.revealed && (
        <div data-testid="ss-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📊 全隊壓力概覽</p>
          {total === 0 ? (
            <p data-testid="ss-empty" className="text-gray-400 text-sm">
              尚無回報
            </p>
          ) : (
            <>
              <div
                data-testid="ss-avg"
                className="p-2 bg-orange-50 rounded text-center"
              >
                <p className="text-xs text-gray-500">團隊平均壓力</p>
                <p className="text-2xl font-bold text-orange-600">{avgLevel()}</p>
                <p className="text-xs text-gray-400">/ 5.0</p>
              </div>

              <div className="space-y-1.5">
                {LEVELS.map((l) => {
                  const count = state.entries.filter((e) => e.level === l.value).length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div
                      key={l.value}
                      data-testid={`ss-bar-${l.value}`}
                      className="space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">
                          {l.emoji} {l.label}
                        </span>
                        <span className="text-gray-400">{count} 人 ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${l.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div data-testid="ss-member-list" className="space-y-1 pt-2 border-t">
                {state.entries.map((e) => {
                  const l = getLevelDef(e.level);
                  return (
                    <div
                      key={e.entryId}
                      data-testid={`ss-card-${e.entryId}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span>{l?.emoji}</span>
                      <span className="text-gray-700">{e.userName}</span>
                      <span className="text-gray-400">
                        等級 {e.level}・{e.stressor}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default StressSignal;
