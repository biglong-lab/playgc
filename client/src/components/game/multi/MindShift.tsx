import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MindShiftEntry {
  entryId: string;
  userId: string;
  userName: string;
  before: string;
  after: string;
}

interface MindShiftState extends Record<string, unknown> {
  shifts: MindShiftEntry[];
  revealed: boolean;
}

interface MindShiftConfig {
  title?: string;
  prompt?: string;
}

interface MindShiftProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: MindShiftConfig;
}

const CARD_COLORS = [
  "from-violet-50 to-purple-50 border-violet-200",
  "from-blue-50 to-indigo-50 border-blue-200",
  "from-teal-50 to-cyan-50 border-teal-200",
  "from-rose-50 to-pink-50 border-rose-200",
  "from-amber-50 to-yellow-50 border-amber-200",
  "from-emerald-50 to-green-50 border-emerald-200",
];

export function MindShift({ gameId, sessionId, pageId, isTeamLead, config }: MindShiftProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MindShiftState>({
    gameId,
    sessionId,
    pageId,
    type: "mind_shift",
    defaultState: { shifts: [], revealed: false },
  });

  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");

  if (!isLoaded) return <div data-testid="mds-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.shifts.find((s) => s.userId === user?.id);
  const canSubmit = before.trim().length >= 3 && after.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: MindShiftEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      before: before.trim(),
      after: after.trim(),
    };
    updateState({ ...state, shifts: [...state.shifts, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="mds-title" className="text-xl font-bold text-violet-700 text-center">
        {config?.title ?? "思維轉變"}
      </h2>
      <p data-testid="mds-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "分享你今天的思維轉變：從什麼想法，到什麼新想法？"}
      </p>
      <p data-testid="mds-count" className="text-xs text-gray-400 text-center">
        已分享：{state.shifts.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="mds-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊轉變
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="mds-form" className="space-y-3 bg-violet-50 rounded-xl p-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">以前我認為...</label>
            <input
              data-testid="mds-before-input"
              type="text"
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              placeholder="舊想法"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="text-center text-violet-500 font-bold text-lg">↓</div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">現在我相信...</label>
            <input
              data-testid="mds-after-input"
              type="text"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              placeholder="新想法"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            data-testid="mds-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享轉變
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="mds-my-entry" className="p-4 rounded-xl border bg-violet-50 border-violet-200">
          <p className="text-xs text-gray-400 line-through">{myEntry.before}</p>
          <p className="text-center text-violet-400 text-xs my-1">↓</p>
          <p className="text-sm font-medium text-violet-800">{myEntry.after}</p>
        </div>
      )}

      {state.revealed && state.shifts.length === 0 && (
        <div data-testid="mds-empty" className="text-center text-gray-400 py-8">還沒有人分享思維轉變</div>
      )}

      {state.revealed && state.shifts.length > 0 && (
        <div data-testid="mds-result" className="space-y-3">
          {state.shifts.map((s, i) => (
            <div
              key={s.entryId}
              data-testid={`mds-card-${s.entryId}`}
              className={`p-3 rounded-xl border bg-gradient-to-br ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <p className="text-xs font-medium text-gray-500 mb-1">{s.userName}</p>
              <p className="text-xs text-gray-400 line-through">{s.before}</p>
              <p className="text-xs text-center text-gray-400 my-0.5">↓</p>
              <p className="text-sm font-medium">{s.after}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
