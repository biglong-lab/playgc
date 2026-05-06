import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WishingWellEntry {
  entryId: string;
  userId: string;
  userName: string;
  wishType: string;
  wish: string;
}

interface WishingWellState extends Record<string, unknown> {
  entries: WishingWellEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: WishingWellState = { entries: [], revealed: false };

const WISH_TYPES = [
  { id: "peace", label: "平安", icon: "🕊️", desc: "願世界和平，身心安寧" },
  { id: "love", label: "愛情", icon: "💕", desc: "願有人溫柔相待" },
  { id: "career", label: "事業", icon: "🌟", desc: "願夢想成真，事業有成" },
  { id: "health", label: "健康", icon: "🌿", desc: "願身體健康，精力充沛" },
  { id: "wisdom", label: "智慧", icon: "📚", desc: "願思維清晰，智慧增長" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function WishingWell({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WishingWellState>({
    gameId,
    sessionId,
    pageId,
    type: "wishing_well",
    defaultState: DEFAULT_STATE,
  });

  const [selectedType, setSelectedType] = useState("peace");
  const [wish, setWish] = useState("");

  if (!isLoaded) return <div data-testid="wsw-loading">載入中...</div>;

  const title = config?.title ?? "許願井";
  const prompt = config?.prompt ?? "投下你的硬幣，許下心中最深的願望";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = wish.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: WishingWellEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      wishType: selectedType,
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
      <h2 data-testid="wsw-title" className="text-2xl font-bold text-purple-700">
        {title}
      </h2>
      <p data-testid="wsw-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="wsw-count" className="text-sm text-gray-500">
        已投下 {state.entries.length} 枚硬幣
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="wsw-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {WISH_TYPES.map((wt) => (
              <button
                key={wt.id}
                data-testid={`wsw-type-${wt.id}`}
                onClick={() => setSelectedType(wt.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedType === wt.id
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="text-xl">{wt.icon}</div>
                <div className="text-xs font-medium">{wt.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{wt.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="wsw-wish-input"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="寫下你的願望..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
          <button
            data-testid="wsw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-purple-500 text-white font-semibold disabled:opacity-40"
          >
            投入許願井 🪙
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="wsw-my-entry" className="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
          <p className="text-sm text-purple-600 font-medium">
            {WISH_TYPES.find((w) => w.id === myEntry.wishType)?.icon}{" "}
            {WISH_TYPES.find((w) => w.id === myEntry.wishType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.wish}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="wsw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold"
        >
          揭曉所有願望 ✨
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="wsw-empty" className="text-center text-gray-400 py-8">
          井中空空如也
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="wsw-result" className="space-y-3">
          <h3 className="font-semibold text-purple-700">所有願望已揭曉</h3>
          {state.entries.map((entry) => {
            const wt = WISH_TYPES.find((w) => w.id === entry.wishType);
            return (
              <div
                key={entry.entryId}
                data-testid={`wsw-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-purple-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{wt?.icon}</span>
                  <span className="font-medium text-purple-700">{wt?.label}</span>
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
