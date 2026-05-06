import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GratitudeTreeEntry {
  entryId: string;
  userId: string;
  userName: string;
  target: string;
  message: string;
}

interface GratitudeTreeState extends Record<string, unknown> {
  entries: GratitudeTreeEntry[];
  revealed: boolean;
}

interface GratitudeTreeConfig {
  title?: string;
  prompt?: string;
}

interface GratitudeTreeProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: GratitudeTreeConfig;
}

const TARGETS = [
  { id: "self", label: "自己", icon: "🌱" },
  { id: "teammate", label: "隊友", icon: "🤝" },
  { id: "mentor", label: "導師", icon: "🌟" },
  { id: "environment", label: "環境", icon: "🌿" },
  { id: "chance", label: "機緣", icon: "✨" },
];

const CARD_COLORS = [
  "bg-green-50 border-green-200",
  "bg-emerald-50 border-emerald-200",
  "bg-teal-50 border-teal-200",
  "bg-lime-50 border-lime-200",
  "bg-cyan-50 border-cyan-200",
];

export function GratitudeTree({ gameId, sessionId, pageId, isTeamLead, config }: GratitudeTreeProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GratitudeTreeState>({
    gameId,
    sessionId,
    pageId,
    type: "gratitude_tree",
    defaultState: { entries: [], revealed: false },
  });

  const [target, setTarget] = useState("self");
  const [message, setMessage] = useState("");

  if (!isLoaded) return <div data-testid="gtr-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = message.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: GratitudeTreeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      target,
      message: message.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedTarget = TARGETS.find((t) => t.id === target)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="gtr-title" className="text-xl font-bold text-green-700 text-center">
        {config?.title ?? "感恩之樹"}
      </h2>
      <p data-testid="gtr-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "此刻，你最想感謝誰？說出你的感謝。"}
      </p>
      <p data-testid="gtr-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="gtr-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉感恩之樹
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="gtr-form" className="space-y-3 bg-green-50 rounded-xl p-4">
          <div data-testid="gtr-target-grid" className="grid grid-cols-5 gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.id}
                data-testid={`gtr-target-${t.id}`}
                onClick={() => setTarget(t.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${
                  target === t.id
                    ? "bg-green-100 border-green-400"
                    : "bg-white border-gray-200 hover:border-green-200"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs text-gray-600">{t.label}</span>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-green-700 font-medium mb-1">
              {selectedTarget.icon} 我感謝{selectedTarget.label}...
            </label>
            <textarea
              data-testid="gtr-message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="寫下你的感謝..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <button
            data-testid="gtr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            送出感謝
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="gtr-my-entry" className="p-4 rounded-xl border-2 bg-green-50 border-green-300 space-y-1">
          <p className="text-sm font-medium text-green-700">
            {TARGETS.find((t) => t.id === myEntry.target)?.icon}{" "}
            感謝{TARGETS.find((t) => t.id === myEntry.target)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.message}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="gtr-empty" className="text-center text-gray-400 py-8">還沒有人寫下感謝</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="gtr-result" className="space-y-2">
          {state.entries.map((e, i) => {
            const tgt = TARGETS.find((t) => t.id === e.target);
            return (
              <div
                key={e.entryId}
                data-testid={`gtr-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-sm font-medium text-gray-700">{tgt?.icon} 感謝{tgt?.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
