import { useState } from "react";
import { Loader2, Sparkles, Star } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DreamEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  dream: string;
}

interface TeamDreamState extends Record<string, unknown> {
  entries: DreamEntry[];
  revealed: boolean;
}

interface TeamDreamConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
  maxLength?: number;
}

function extractConfig(raw: Record<string, unknown>): TeamDreamConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : undefined,
  };
}

const DREAM_COLORS = [
  "bg-violet-50 border-l-violet-400",
  "bg-indigo-50 border-l-indigo-400",
  "bg-purple-50 border-l-purple-400",
  "bg-fuchsia-50 border-l-fuchsia-400",
  "bg-pink-50 border-l-pink-400",
  "bg-blue-50 border-l-blue-400",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamDream({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const maxLength = cfg.maxLength ?? 50;
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamDreamState>({
    gameId,
    sessionId,
    pageId,
    type: "team_dream",
    defaultState: { entries: [], revealed: false },
  });

  const [dream, setDream] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="tdm-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const entries = state.entries as DreamEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === userId);
  const canSubmit = dream.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: DreamEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      dream: dream.trim(),
    };
    updateState({ ...state, entries: [...entries, entry] });
    setDream("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="tdm-title" className="text-xl font-bold text-center">
        {cfg.title ?? "隊伍夢想清單"}
      </div>
      <div data-testid="tdm-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果我們的隊伍能一起實現一件事，你希望是什麼？"}
      </div>
      <div data-testid="tdm-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 個夢想
      </div>

      {!myEntry && (
        <div data-testid="tdm-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="relative">
            <textarea
              data-testid="tdm-dream-input"
              className="border rounded-lg px-3 py-2 text-sm resize-none w-full"
              rows={3}
              maxLength={maxLength}
              placeholder={cfg.placeholder ?? "說說你的夢想… （至少5字）"}
              value={dream}
              onChange={(e) => setDream(e.target.value)}
            />
            <span
              data-testid="tdm-char-count"
              className={`absolute bottom-3 right-3 text-xs ${
                dream.length >= maxLength ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {dream.length}/{maxLength}
            </span>
          </div>
          <button
            data-testid="tdm-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            分享夢想
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="tdm-my-entry" className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-violet-700">你的夢想</span>
          </div>
          <p className="text-sm text-foreground">{myEntry.dream}</p>
          <p className="text-xs text-muted-foreground mt-1">已加入夢想牆</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="tdm-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          揭曉隊伍夢想牆
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="tdm-empty" className="text-center text-muted-foreground p-8">
          還沒有人分享夢想
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="tdm-result" className="flex flex-col gap-2">
          <div data-testid="tdm-wall-title" className="text-sm font-semibold text-center text-violet-700 flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            隊伍夢想牆
          </div>
          {entries.map((e, idx) => (
            <div
              key={e.entryId}
              data-testid={`tdm-card-${e.entryId}`}
              className={`rounded-xl p-3 border-l-4 ${DREAM_COLORS[idx % DREAM_COLORS.length]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-violet-700">{e.userName}</span>
                <Star className="w-3 h-3 text-amber-400" />
              </div>
              <p className="text-sm leading-relaxed">{e.dream}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
