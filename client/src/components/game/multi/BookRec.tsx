import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RecEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  title: string;
  reason: string;
  mediaType: string;
}

interface BookRecState extends Record<string, unknown> {
  entries: RecEntry[];
  revealed: boolean;
}

interface BookRecConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): BookRecConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const MEDIA_TYPES = [
  { id: "book", label: "書籍", emoji: "📚" },
  { id: "movie", label: "電影", emoji: "🎬" },
  { id: "podcast", label: "Podcast", emoji: "🎙️" },
  { id: "documentary", label: "紀錄片", emoji: "🎥" },
  { id: "music", label: "音樂專輯", emoji: "🎵" },
  { id: "game", label: "遊戲", emoji: "🎮" },
];

const CARD_COLORS = [
  "border-l-indigo-400 bg-indigo-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-orange-400 bg-orange-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function BookRec({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BookRecState>({
    gameId,
    sessionId,
    pageId,
    type: "book_rec",
    defaultState: { entries: [], revealed: false },
  });

  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [mediaType, setMediaType] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="br-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as RecEntry[]).find((e) => e.userId === userId);
  const canSubmit = title.trim().length >= 1 && reason.trim().length >= 5 && mediaType !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: RecEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      title: title.trim(),
      reason: reason.trim(),
      mediaType,
    };
    updateState({ ...state, entries: [...(state.entries as RecEntry[]), entry] });
    setTitle("");
    setReason("");
    setMediaType("");
  };

  const entries = state.entries as RecEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="br-title" className="text-xl font-bold text-center">
        {cfg.title ?? "好物推薦"}
      </div>
      <div data-testid="br-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "推薦一本書、一部電影或任何讓你收穫滿滿的內容！"}
      </div>
      <div data-testid="br-count" className="text-xs text-center text-muted-foreground">
        已推薦 {entries.length} 個
      </div>

      {!myEntry && (
        <div data-testid="br-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {MEDIA_TYPES.map((m) => (
              <button
                key={m.id}
                data-testid={`br-type-${m.id}`}
                onClick={() => setMediaType(m.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${mediaType === m.id ? "border-indigo-400 bg-indigo-50 font-semibold" : "hover:border-indigo-300"}`}
              >
                <span className="text-xl mb-1">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
          <input
            data-testid="br-title-input"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="名稱（書名、片名...）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            data-testid="br-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="推薦理由（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="br-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            推薦出去！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="br-my-entry" className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
          <div className="text-xs text-indigo-500 mb-1">
            {MEDIA_TYPES.find((m) => m.id === myEntry.mediaType)?.emoji}{" "}
            {MEDIA_TYPES.find((m) => m.id === myEntry.mediaType)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.title}</div>
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="br-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉大家的推薦
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="br-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人推薦內容
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="br-result" className="flex flex-col gap-3">
          <div data-testid="br-rec-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const mtype = MEDIA_TYPES.find((m) => m.id === e.mediaType);
              return (
                <div
                  key={e.entryId}
                  data-testid={`br-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{mtype?.emoji}</span>
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
