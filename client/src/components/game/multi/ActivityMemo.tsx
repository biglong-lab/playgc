import { useState } from "react";
import { Loader2, BookOpen, Lightbulb } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MemoEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  keyword: string;
  action: string;
}

interface ActivityMemoState extends Record<string, unknown> {
  entries: MemoEntry[];
  revealed: boolean;
}

interface ActivityMemoConfig {
  title?: string;
  keywordPrompt?: string;
  actionPrompt?: string;
  keywordPlaceholder?: string;
  actionPlaceholder?: string;
}

function extractConfig(raw: Record<string, unknown>): ActivityMemoConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    keywordPrompt: typeof raw.keywordPrompt === "string" ? raw.keywordPrompt : undefined,
    actionPrompt: typeof raw.actionPrompt === "string" ? raw.actionPrompt : undefined,
    keywordPlaceholder: typeof raw.keywordPlaceholder === "string" ? raw.keywordPlaceholder : undefined,
    actionPlaceholder: typeof raw.actionPlaceholder === "string" ? raw.actionPlaceholder : undefined,
  };
}

const CARD_COLORS = [
  "bg-sky-50 border-l-sky-400",
  "bg-teal-50 border-l-teal-400",
  "bg-emerald-50 border-l-emerald-400",
  "bg-cyan-50 border-l-cyan-400",
  "bg-indigo-50 border-l-indigo-400",
  "bg-blue-50 border-l-blue-400",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ActivityMemo({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ActivityMemoState>({
    gameId,
    sessionId,
    pageId,
    type: "activity_memo",
    defaultState: { entries: [], revealed: false },
  });

  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="amm-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const entries = state.entries as MemoEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === userId);
  const canSubmit = keyword.trim().length >= 1 && action.trim().length >= 3;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MemoEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      keyword: keyword.trim(),
      action: action.trim(),
    };
    updateState({ ...state, entries: [...entries, entry] });
    setKeyword("");
    setAction("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="amm-title" className="text-xl font-bold text-center">
        {cfg.title ?? "活動備忘錄"}
      </div>
      <div data-testid="amm-count" className="text-xs text-center text-muted-foreground">
        已完成 {entries.length} 份備忘錄
      </div>

      {!myEntry && (
        <div data-testid="amm-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {cfg.keywordPrompt ?? "這次最大的收穫是什麼？（一個關鍵詞）"}
            </label>
            <input
              data-testid="amm-keyword-input"
              type="text"
              className="border rounded-lg px-3 py-2 text-sm w-full"
              placeholder={cfg.keywordPlaceholder ?? "例：溝通、信任、創意…"}
              maxLength={10}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {cfg.actionPrompt ?? "回去之後，你打算採取什麼行動？"}
            </label>
            <input
              data-testid="amm-action-input"
              type="text"
              className="border rounded-lg px-3 py-2 text-sm w-full"
              placeholder={cfg.actionPlaceholder ?? "例：每天和隊友分享一件事…"}
              maxLength={50}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <button
            data-testid="amm-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            完成備忘錄
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="amm-my-entry" className="bg-teal-50 rounded-xl p-3 border border-teal-200">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-teal-500" />
            <span className="text-sm font-semibold text-teal-700">你的備忘錄</span>
          </div>
          <div className="flex gap-2 mb-1">
            <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-1 rounded-full">
              {myEntry.keyword}
            </span>
          </div>
          <p className="text-sm text-foreground">{myEntry.action}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="amm-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-teal-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          分享全隊備忘錄
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="amm-empty" className="text-center text-muted-foreground p-8">
          還沒有人完成備忘錄
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="amm-result" className="flex flex-col gap-2">
          <div data-testid="amm-result-title" className="text-sm font-semibold text-center text-teal-700 flex items-center justify-center gap-1">
            <Lightbulb className="w-4 h-4" />
            全隊活動備忘錄
          </div>
          {entries.map((e, idx) => (
            <div
              key={e.entryId}
              data-testid={`amm-card-${e.entryId}`}
              className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-teal-700">{e.userName}</span>
                <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  {e.keyword}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{e.action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
