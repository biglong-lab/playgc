import { useState } from "react";
import { Mountain, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PeakEntry {
  entryId: string;
  userId: string;
  userName: string;
  moment: string;
  feeling: string;
}

interface PeakMomentState extends Record<string, unknown> {
  entries: PeakEntry[];
  revealed: boolean;
}

interface PeakMomentConfig {
  title: string;
  prompt: string;
  momentPlaceholder: string;
  feelingPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): PeakMomentConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "最高光時刻",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "這次體驗中，你印象最深刻的一個高光時刻是什麼？當時你的感受如何？",
    momentPlaceholder: typeof raw.momentPlaceholder === "string" ? raw.momentPlaceholder : "最難忘的一個時刻...",
    feelingPlaceholder: typeof raw.feelingPlaceholder === "string" ? raw.feelingPlaceholder : "當時的感受（一個詞或一句話）",
  };
}

const PEAK_COLORS = [
  "border-l-rose-400 bg-rose-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-pink-400 bg-pink-50",
];

const DEFAULT_STATE: PeakMomentState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PeakMoment({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<PeakMomentState>({
    gameId,
    sessionId,
    pageId,
    type: "peak_moment",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [moment, setMoment] = useState("");
  const [feeling, setFeeling] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="pm-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!moment.trim()) return;
    const entry: PeakEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      moment: moment.trim(),
      feeling: feeling.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function colorFor(i: number) {
    return PEAK_COLORS[i % PEAK_COLORS.length];
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mountain className="w-5 h-5 text-violet-600" />
        <h2 className="text-xl font-bold" data-testid="pm-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="pm-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="pm-count">已分享：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <textarea
            data-testid="pm-moment-input"
            className="w-full border rounded p-2 text-sm resize-none h-20"
            placeholder={cfg.momentPlaceholder}
            maxLength={120}
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
          />
          <input
            data-testid="pm-feeling-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.feelingPlaceholder}
            maxLength={30}
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
          />
          <button
            data-testid="pm-submit-btn"
            disabled={!moment.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 bg-violet-600 text-white rounded disabled:opacity-40 text-sm"
          >
            分享我的高光時刻
          </button>
        </div>
      ) : (
        <div className="p-3 bg-violet-50 rounded border border-violet-200 text-sm space-y-1" data-testid="pm-my-entry">
          <p className="text-gray-700 italic">"{myEntry.moment}"</p>
          {myEntry.feeling && (
            <p className="text-violet-600 font-medium text-xs">感受：{myEntry.feeling}</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="pm-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊高光時刻
        </button>
      )}

      {state.revealed && (
        <div data-testid="pm-result" className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">✨ 全隊高光時刻集錦</p>
          {state.entries.length === 0 ? (
            <p data-testid="pm-empty" className="text-gray-400 text-sm">尚無分享</p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`pm-card-${entry.entryId}`}
                  className={`border-l-4 pl-3 py-2 rounded-r ${colorFor(i)}`}
                >
                  <p className="text-xs text-gray-500 font-medium">{entry.userName}</p>
                  <p className="text-sm text-gray-700 italic mt-0.5">"{entry.moment}"</p>
                  {entry.feeling && (
                    <p className="text-xs text-gray-500 mt-1">💭 {entry.feeling}</p>
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

export default PeakMoment;
