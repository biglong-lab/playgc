import { useState } from "react";
import { Loader2, BookOpen } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LegacyEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  word: string;
  reason: string;
}

interface LegacyWordState extends Record<string, unknown> {
  entries: LegacyEntry[];
  revealed: boolean;
}

interface LegacyWordConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): LegacyWordConfig {
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

export function LegacyWord({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LegacyWordState>({
    gameId,
    sessionId,
    pageId,
    type: "legacy_word",
    defaultState: { entries: [], revealed: false },
  });

  const [word, setWord] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="lgw-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const entries = state.entries as LegacyEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === userId);
  const canSubmit = word.trim().length >= 1 && reason.trim().length >= 4;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...entries, { entryId, userId, userName, word: word.trim(), reason: reason.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="lgw-title" className="text-xl font-bold text-center">
        {cfg.title ?? "傳承之詞"}
      </div>
      <div data-testid="lgw-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "你想傳遞給下一個人的一個詞是什麼？"}
      </div>
      <div data-testid="lgw-count" className="text-xs text-center text-muted-foreground">
        已有 {entries.length} 人分享
      </div>

      {!myEntry && (
        <div data-testid="lgw-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div>
            <label className="text-sm font-medium mb-1 block">傳承的詞</label>
            <input
              data-testid="lgw-word-input"
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="一個詞"
              maxLength={10}
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">為什麼選這個詞？</label>
            <textarea
              data-testid="lgw-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="說說你的理由（至少 4 字）"
              maxLength={80}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            />
          </div>
          <button
            data-testid="lgw-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            傳遞這個詞
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="lgw-my-entry" className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="text-sm font-semibold text-amber-700 mb-2">你已傳承你的詞</div>
          <div className="text-xl font-bold text-amber-800 mb-1">{myEntry.word}</div>
          <p className="text-xs text-gray-600">{myEntry.reason}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="lgw-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          揭曉全隊傳承
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="lgw-empty" className="text-center text-muted-foreground p-8">
          還沒有人分享傳承之詞
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="lgw-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-amber-700">
            📖 傳承之詞（{entries.length} 人）
          </div>
          {entries.map((e) => (
            <div
              key={e.entryId}
              data-testid={`lgw-card-${e.entryId}`}
              className="bg-amber-50 rounded-xl p-3 border border-amber-100"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-amber-700 text-base">{e.word}</span>
                <span className="text-xs text-muted-foreground">— {e.userName}</span>
              </div>
              <p className="text-xs text-gray-600">{e.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
