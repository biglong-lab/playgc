import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StarCatcherEntry {
  entryId: string;
  userId: string;
  userName: string;
  starType: string;
  wish: string;
}

interface StarCatcherState extends Record<string, unknown> {
  entries: StarCatcherEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: StarCatcherState = { entries: [], revealed: false };

const STAR_TYPES = [
  { id: "shooting_star", label: "流星", icon: "🌠", desc: "瞬間閃耀的偉大夢想" },
  { id: "fixed_star", label: "恆星", icon: "⭐", desc: "永恆不變的核心信念" },
  { id: "morning_star", label: "晨星", icon: "🌟", desc: "黎明前的希望之光" },
  { id: "evening_star", label: "夕星", icon: "✨", desc: "日落後的寧靜等待" },
  { id: "guiding_star", label: "北極星", icon: "🧭", desc: "指引方向的人生燈塔" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function StarCatcher({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<StarCatcherState>({
    gameId,
    sessionId,
    pageId,
    type: "star_catcher",
    defaultState: DEFAULT_STATE,
  });

  const [selectedStar, setSelectedStar] = useState("shooting_star");
  const [wish, setWish] = useState("");

  if (!isLoaded) return <div data-testid="stc-loading">載入中...</div>;

  const title = config?.title ?? "捕星人";
  const prompt = config?.prompt ?? "伸出雙手，捕捉屬於你的那顆星，分享它代表什麼";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = wish.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: StarCatcherEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      starType: selectedStar,
      wish: wish.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setWish("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="stc-title" className="text-2xl font-bold text-violet-700">
        {title}
      </h2>
      <p data-testid="stc-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="stc-count" className="text-sm text-gray-500">
        已捕捉 {state.entries.length} 顆星
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="stc-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {STAR_TYPES.map((st) => (
              <button
                key={st.id}
                data-testid={`stc-star-${st.id}`}
                onClick={() => setSelectedStar(st.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedStar === st.id
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-200 hover:border-violet-300"
                }`}
              >
                <div className="text-xl">{st.icon}</div>
                <div className="text-xs font-medium">{st.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{st.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="stc-wish-input"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="分享這顆星代表什麼..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-violet-400 focus:outline-none"
          />
          <button
            data-testid="stc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-violet-500 text-white font-semibold disabled:opacity-40"
          >
            捕捉星光 ✨
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="stc-my-entry" className="p-4 bg-violet-50 rounded-xl border border-violet-200 space-y-1">
          <p className="text-sm text-violet-600 font-medium">
            {STAR_TYPES.find((s) => s.id === myEntry.starType)?.icon}{" "}
            {STAR_TYPES.find((s) => s.id === myEntry.starType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.wish}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="stc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold"
        >
          揭曉所有星光 🌌
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="stc-empty" className="text-center text-gray-400 py-8">
          星空中尚無捕捉
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="stc-result" className="space-y-3">
          <h3 className="font-semibold text-violet-700">所有星光已揭曉</h3>
          {state.entries.map((entry) => {
            const st = STAR_TYPES.find((s) => s.id === entry.starType);
            return (
              <div
                key={entry.entryId}
                data-testid={`stc-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-violet-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{st?.icon}</span>
                  <span className="font-medium text-violet-700">{st?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.wish}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
