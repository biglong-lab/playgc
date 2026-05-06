import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface AbilityBadgeEntry {
  entryId: string;
  userId: string;
  userName: string;
  badgeType: string;
  evidence: string;
}

interface AbilityBadgeState extends Record<string, unknown> {
  badges: AbilityBadgeEntry[];
  revealed: boolean;
}

interface AbilityBadgeConfig {
  title?: string;
  prompt?: string;
}

interface AbilityBadgeProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: AbilityBadgeConfig;
}

const BADGE_OPTIONS = [
  { key: "creativity", label: "創意力", icon: "💡" },
  { key: "courage", label: "勇氣", icon: "🦁" },
  { key: "collaboration", label: "協作力", icon: "🤝" },
  { key: "communication", label: "溝通力", icon: "💬" },
  { key: "persistence", label: "堅持力", icon: "🏆" },
];

const BADGE_COLORS: Record<string, string> = {
  creativity: "bg-yellow-100 border-yellow-400 text-yellow-800",
  courage: "bg-red-100 border-red-400 text-red-800",
  collaboration: "bg-blue-100 border-blue-400 text-blue-800",
  communication: "bg-green-100 border-green-400 text-green-800",
  persistence: "bg-purple-100 border-purple-400 text-purple-800",
};

export function AbilityBadge({ gameId, sessionId, pageId, isTeamLead, config }: AbilityBadgeProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<AbilityBadgeState>({
    gameId,
    sessionId,
    pageId,
    type: "ability_badge",
    defaultState: { badges: [], revealed: false },
  });

  const [selectedBadge, setSelectedBadge] = useState("creativity");
  const [evidence, setEvidence] = useState("");

  if (!isLoaded) return <div data-testid="abg-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.badges.find((b) => b.userId === user?.id);
  const canSubmit = evidence.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: AbilityBadgeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      badgeType: selectedBadge,
      evidence: evidence.trim(),
    };
    updateState({ ...state, badges: [...state.badges, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="abg-title" className="text-xl font-bold text-indigo-700 text-center">
        {config?.title ?? "能力徽章"}
      </h2>
      <p data-testid="abg-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "選一個你今天展現的能力，並說明具體事例"}
      </p>
      <p data-testid="abg-count" className="text-xs text-gray-400 text-center">
        已獲徽章：{state.badges.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="abg-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊徽章
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="abg-form" className="space-y-3 bg-indigo-50 rounded-xl p-4">
          <div data-testid="abg-badge-grid" className="grid grid-cols-5 gap-2">
            {BADGE_OPTIONS.map((b) => (
              <button
                key={b.key}
                data-testid={`abg-badge-${b.key}`}
                onClick={() => setSelectedBadge(b.key)}
                className={`flex flex-col items-center p-2 rounded-lg border-2 text-xs transition-all ${
                  selectedBadge === b.key
                    ? "bg-indigo-200 border-indigo-500 font-bold"
                    : "bg-white border-gray-200"
                }`}
              >
                <span className="text-lg">{b.icon}</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>
          <input
            data-testid="abg-evidence-input"
            type="text"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="具體說明你如何展現這個能力..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            data-testid="abg-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            領取徽章
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="abg-my-entry" className={`p-4 rounded-xl border-2 ${BADGE_COLORS[myEntry.badgeType] ?? "bg-gray-100 border-gray-300"}`}>
          <p className="font-bold text-sm">
            {BADGE_OPTIONS.find((b) => b.key === myEntry.badgeType)?.icon}{" "}
            {BADGE_OPTIONS.find((b) => b.key === myEntry.badgeType)?.label}
          </p>
          <p className="text-xs mt-1">{myEntry.evidence}</p>
        </div>
      )}

      {state.revealed && state.badges.length === 0 && (
        <div data-testid="abg-empty" className="text-center text-gray-400 py-8">還沒有人領取徽章</div>
      )}

      {state.revealed && state.badges.length > 0 && (
        <div data-testid="abg-result" className="space-y-2">
          {state.badges.map((b) => (
            <div
              key={b.entryId}
              data-testid={`abg-card-${b.entryId}`}
              className={`p-3 rounded-xl border-2 ${BADGE_COLORS[b.badgeType] ?? "bg-gray-100 border-gray-300"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{BADGE_OPTIONS.find((x) => x.key === b.badgeType)?.icon}</span>
                <span className="font-bold text-sm">{b.userName}</span>
                <span className="text-xs opacity-70">· {BADGE_OPTIONS.find((x) => x.key === b.badgeType)?.label}</span>
              </div>
              <p className="text-xs mt-1">{b.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
