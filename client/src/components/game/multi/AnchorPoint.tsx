import { useState } from "react";
import { Loader2, Anchor } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface AnchorEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  anchor: string;
}

interface AnchorPointState extends Record<string, unknown> {
  entries: AnchorEntry[];
  revealed: boolean;
}

interface AnchorPointConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): AnchorPointConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function AnchorPoint({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<AnchorPointState>({
    gameId,
    sessionId,
    pageId,
    type: "anchor_point",
    defaultState: { entries: [], revealed: false },
  });

  const [anchor, setAnchor] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="anp-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const entries = state.entries as AnchorEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === userId);
  const canSubmit = anchor.trim().length >= 4;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...entries, { entryId, userId, userName, anchor: anchor.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="anp-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我的錨點"}
      </div>
      <div data-testid="anp-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "什麼是讓你保持穩定的核心價值或習慣？"}
      </div>
      <div data-testid="anp-count" className="text-xs text-center text-muted-foreground">
        已有 {entries.length} 人分享
      </div>

      {!myEntry && (
        <div data-testid="anp-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <textarea
            data-testid="anp-anchor-input"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            placeholder="寫下你的錨點（至少 4 字）"
            maxLength={60}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
          <div className="text-xs text-right text-muted-foreground">{anchor.length}/60</div>
          <button
            data-testid="anp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Anchor className="w-4 h-4" />
            放下錨點
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="anp-my-entry" className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
          <div className="flex items-center gap-2 mb-1">
            <Anchor className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-700">你的錨點已記錄</span>
          </div>
          <p className="text-sm text-gray-700">{myEntry.anchor}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="anp-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Anchor className="w-4 h-4" />
          揭曉全隊錨點
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="anp-empty" className="text-center text-muted-foreground p-8">
          還沒有人分享錨點
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="anp-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-indigo-700">
            ⚓ 全隊錨點（{entries.length} 人）
          </div>
          {entries.map((e) => (
            <div
              key={e.entryId}
              data-testid={`anp-card-${e.entryId}`}
              className="bg-indigo-50 rounded-xl p-3 border border-indigo-100"
            >
              <div className="text-xs text-indigo-500 font-medium mb-1">{e.userName}</div>
              <p className="text-sm text-gray-800">{e.anchor}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
