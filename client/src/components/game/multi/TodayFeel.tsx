import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FeelEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  word: string;
  emoji: string;
}

interface TodayFeelState extends Record<string, unknown> {
  entries: FeelEntry[];
  revealed: boolean;
}

interface TodayFeelConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): TodayFeelConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const EMOJIS = ["😊", "😄", "🔥", "💪", "🌟", "🤔", "😴", "💫", "🌈", "❤️", "🚀", "✨"];

const CARD_COLORS = [
  "from-pink-400 to-rose-400",
  "from-orange-400 to-amber-400",
  "from-yellow-400 to-lime-400",
  "from-green-400 to-teal-400",
  "from-cyan-400 to-sky-400",
  "from-blue-400 to-indigo-400",
  "from-violet-400 to-purple-400",
  "from-fuchsia-400 to-pink-400",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TodayFeel({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TodayFeelState>({
    gameId,
    sessionId,
    pageId,
    type: "today_feel",
    defaultState: { entries: [], revealed: false },
  });

  const [word, setWord] = useState("");
  const [emoji, setEmoji] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="tf-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as FeelEntry[]).find((e) => e.userId === userId);
  const canSubmit = word.trim().length >= 1 && emoji !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: FeelEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      word: word.trim(),
      emoji,
    };
    updateState({ ...state, entries: [...(state.entries as FeelEntry[]), entry] });
    setWord("");
    setEmoji("");
  };

  const entries = state.entries as FeelEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="tf-title" className="text-xl font-bold text-center">
        {cfg.title ?? "今天感覺"}
      </div>
      <div data-testid="tf-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "用一個詞語＋一個 emoji 描述你今天的感受！"}
      </div>
      <div data-testid="tf-count" className="text-xs text-center text-muted-foreground">
        已提交 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="tf-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <input
            data-testid="tf-word-input"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="輸入一個詞語（如：期待、充實、輕鬆...）"
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
          <div data-testid="tf-emoji-picker" className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                data-testid={`tf-emoji-${e}`}
                onClick={() => setEmoji(e)}
                className={`text-2xl rounded-lg p-1 transition-transform ${emoji === e ? "ring-2 ring-primary scale-110" : "hover:scale-110"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <button
            data-testid="tf-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            提交感受
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="tf-my-entry" className="bg-muted rounded-xl p-3 text-center border">
          <span className="text-2xl">{myEntry.emoji}</span>
          <span className="ml-2 font-semibold">{myEntry.word}</span>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="tf-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊感受
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="tf-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人提交感受
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="tf-result" className="flex flex-col gap-4">
          <div data-testid="tf-word-wall" className="flex flex-wrap gap-2 justify-center">
            {entries.map((e, i) => (
              <span
                key={e.entryId}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm font-medium bg-gradient-to-r ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                {e.emoji} {e.word}
              </span>
            ))}
          </div>
          <div data-testid="tf-member-list" className="flex flex-col gap-2">
            {entries.map((e) => (
              <div
                key={e.entryId}
                data-testid={`tf-card-${e.entryId}`}
                className="bg-card rounded-lg p-3 border flex items-center gap-3"
              >
                <span className="text-2xl">{e.emoji}</span>
                <div>
                  <div className="text-sm font-semibold">{e.userName}</div>
                  <div className="text-xs text-muted-foreground">{e.word}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
