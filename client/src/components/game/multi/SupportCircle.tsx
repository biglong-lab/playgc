import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SupportCircleEntry {
  entryId: string;
  userId: string;
  userName: string;
  needType: string;
  request: string;
}

interface SupportCircleState extends Record<string, unknown> {
  entries: SupportCircleEntry[];
  revealed: boolean;
}

interface SupportCircleConfig {
  title?: string;
  prompt?: string;
}

interface SupportCircleProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: SupportCircleConfig;
}

const NEED_TYPES = [
  { key: "help", label: "幫忙", icon: "🙌", color: "bg-blue-100 border-blue-400 text-blue-800" },
  { key: "encourage", label: "鼓勵", icon: "💪", color: "bg-green-100 border-green-400 text-green-800" },
  { key: "advice", label: "建議", icon: "💬", color: "bg-purple-100 border-purple-400 text-purple-800" },
  { key: "resource", label: "資源", icon: "📦", color: "bg-orange-100 border-orange-400 text-orange-800" },
  { key: "space", label: "空間", icon: "🌿", color: "bg-teal-100 border-teal-400 text-teal-800" },
];

const CARD_COLORS = [
  "bg-blue-50 border-blue-200",
  "bg-green-50 border-green-200",
  "bg-purple-50 border-purple-200",
  "bg-orange-50 border-orange-200",
  "bg-teal-50 border-teal-200",
];

export function SupportCircle({ gameId, sessionId, pageId, isTeamLead, config }: SupportCircleProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SupportCircleState>({
    gameId,
    sessionId,
    pageId,
    type: "support_circle",
    defaultState: { entries: [], revealed: false },
  });

  const [needType, setNeedType] = useState("help");
  const [request, setRequest] = useState("");

  if (!isLoaded) return <div data-testid="sco-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = request.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: SupportCircleEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      needType,
      request: request.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="sco-title" className="text-xl font-bold text-blue-700 text-center">
        {config?.title ?? "支持圈"}
      </h2>
      <p data-testid="sco-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "你需要隊伍給你什麼支持？選擇類型並寫下具體需求"}
      </p>
      <p data-testid="sco-count" className="text-xs text-gray-400 text-center">
        已分享：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="sco-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊需求
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="sco-form" className="space-y-3 bg-blue-50 rounded-xl p-4">
          <div data-testid="sco-need-grid" className="grid grid-cols-5 gap-2">
            {NEED_TYPES.map((n) => (
              <button
                key={n.key}
                data-testid={`sco-need-${n.key}`}
                onClick={() => setNeedType(n.key)}
                className={`flex flex-col items-center py-2 rounded-lg border-2 text-xs transition-all ${
                  needType === n.key ? `${n.color} border-2` : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                <span className="text-lg">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sco-request-input"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="具體說明你需要什麼幫助..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            data-testid="sco-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            提出需求
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="sco-my-entry" className={`p-4 rounded-xl border-2 ${NEED_TYPES.find((n) => n.key === myEntry.needType)?.color ?? "bg-gray-100 border-gray-300"}`}>
          <p className="text-sm font-bold">
            {NEED_TYPES.find((n) => n.key === myEntry.needType)?.icon}{" "}
            {NEED_TYPES.find((n) => n.key === myEntry.needType)?.label}
          </p>
          <p className="text-sm mt-1">{myEntry.request}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="sco-empty" className="text-center text-gray-400 py-8">還沒有人分享需求</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="sco-result" className="space-y-2">
          {state.entries.map((e, i) => (
            <div
              key={e.entryId}
              data-testid={`sco-card-${e.entryId}`}
              className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{NEED_TYPES.find((n) => n.key === e.needType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-gray-400">· {NEED_TYPES.find((n) => n.key === e.needType)?.label}</span>
              </div>
              <p className="text-sm">{e.request}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
