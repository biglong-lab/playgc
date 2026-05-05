import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface EnergyEntry {
  entryId: string;
  userId: string;
  userName: string;
  level: number;
  note: string;
}

interface EnergyLevelState extends Record<string, unknown> {
  entries: EnergyEntry[];
  revealed: boolean;
}

interface EnergyLevelConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): EnergyLevelConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "能量值",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "現在你的能量值是幾分？（1 = 很低，5 = 很高）",
  };
}

const LEVEL_COLORS = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500"];
const LEVEL_EMOJI = ["😴", "😐", "🙂", "😊", "🔥"];

const DEFAULT_STATE: EnergyLevelState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function EnergyLevel({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<EnergyLevelState>({
    gameId,
    sessionId,
    pageId,
    type: "energy_level",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");

  if (!isLoaded) return <Zap className="animate-pulse" data-testid="el-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (selected === null) return;
    const entry: EnergyEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      level: selected,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const avgLevel = state.entries.length > 0
    ? (state.entries.reduce((sum, e) => sum + e.level, 0) / state.entries.length).toFixed(1)
    : "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h2 className="text-xl font-bold" data-testid="el-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="el-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="el-count">已回答：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <div className="flex gap-2 justify-center" data-testid="el-scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                data-testid={`el-level-${n}`}
                onClick={() => setSelected(n)}
                className={`w-12 h-12 rounded-full text-white font-bold text-lg transition-transform ${
                  LEVEL_COLORS[n - 1]
                } ${selected === n ? "ring-4 ring-offset-2 ring-gray-400 scale-110" : "opacity-70 hover:opacity-100"}`}
              >
                {n}
              </button>
            ))}
          </div>
          {selected !== null && (
            <p className="text-center text-2xl" data-testid="el-emoji">{LEVEL_EMOJI[selected - 1]}</p>
          )}
          <input
            data-testid="el-note-input"
            className="w-full border rounded p-2 text-sm"
            placeholder="補充說明（選填）"
            maxLength={60}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            data-testid="el-submit-btn"
            disabled={selected === null}
            onClick={handleSubmit}
            className="px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出能量值
          </button>
        </div>
      ) : (
        <div className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm" data-testid="el-my-entry">
          我的能量值：{myEntry.level} {LEVEL_EMOJI[myEntry.level - 1]}
          {myEntry.note && <span className="ml-2 text-gray-500">（{myEntry.note}）</span>}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="el-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示團隊能量
        </button>
      )}

      {state.revealed && (
        <div data-testid="el-result" className="space-y-3">
          <div className="text-center">
            <span className="text-3xl font-bold text-yellow-500" data-testid="el-avg">{avgLevel}</span>
            <span className="text-gray-500 text-sm ml-2">團隊平均能量值</span>
          </div>
          {state.entries.length === 0 ? (
            <p data-testid="el-empty" className="text-gray-400 text-sm">尚無資料</p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`el-card-${entry.entryId}`}
                  className="flex items-center gap-3 bg-gray-50 rounded p-2"
                >
                  <span className={`w-8 h-8 rounded-full ${LEVEL_COLORS[entry.level - 1]} flex items-center justify-center text-white font-bold text-sm`}>
                    {entry.level}
                  </span>
                  <span className="text-sm font-medium">{entry.userName}</span>
                  {entry.note && <span className="text-xs text-gray-500">— {entry.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EnergyLevel;
