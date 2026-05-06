import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WordEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  word: string;
}

interface FirstWordState extends Record<string, unknown> {
  words: WordEntry[];
  revealed: boolean;
}

interface FirstWordConfig {
  title?: string;
  question?: string;
}

function extractConfig(raw: Record<string, unknown>): FirstWordConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    question: typeof raw.question === "string" ? raw.question : undefined,
  };
}

const WORD_COLORS = [
  "bg-red-100 text-red-700 border-red-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-purple-100 text-purple-700 border-purple-200",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FirstWord({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FirstWordState>({
    gameId,
    sessionId,
    pageId,
    type: "first_word",
    defaultState: { words: [], revealed: false },
  });

  const [word, setWord] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="fwd-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const words = state.words as WordEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = words.find((w) => w.userId === userId);
  const canSubmit = word.trim().length >= 1 && word.trim().length <= 10;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      words: [...words, { entryId, userId, userName, word: word.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="fwd-title" className="text-xl font-bold text-center">
        {cfg.title ?? "第一個字"}
      </div>
      <div data-testid="fwd-question" className="text-sm text-center text-muted-foreground">
        {cfg.question ?? "看到這個活動，你腦中浮現的第一個詞是什麼？"}
      </div>
      <div data-testid="fwd-count" className="text-xs text-center text-muted-foreground">
        已有 {words.length} 人回應
      </div>

      {!myEntry && (
        <div data-testid="fwd-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <input
            data-testid="fwd-word-input"
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="輸入 1-10 字的詞"
            maxLength={10}
            className="w-full border rounded-lg px-3 py-2 text-sm text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <div className="text-xs text-right text-muted-foreground">{word.length}/10</div>
          <button
            data-testid="fwd-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            送出我的詞
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="fwd-my-entry" className="bg-violet-50 rounded-xl p-4 border border-violet-200 text-center">
          <div className="text-sm font-semibold text-violet-700 mb-1">你的詞已送出</div>
          <div className="text-2xl font-bold text-violet-600">{myEntry.word}</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="fwd-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          揭曉全隊詞雲
        </button>
      )}

      {revealed && words.length === 0 && (
        <div data-testid="fwd-empty" className="text-center text-muted-foreground p-8">
          還沒有人送出詞
        </div>
      )}

      {revealed && words.length > 0 && (
        <div data-testid="fwd-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-violet-700">
            ⚡ 全隊詞雲（{words.length} 個詞）
          </div>
          <div className="flex flex-wrap gap-2 justify-center p-4">
            {words.map((w, idx) => (
              <div
                key={w.entryId}
                data-testid={`fwd-word-${w.entryId}`}
                className={`px-3 py-2 rounded-full border text-sm font-bold ${WORD_COLORS[idx % WORD_COLORS.length]}`}
              >
                {w.word}
              </div>
            ))}
          </div>
          <div className="text-xs text-center text-muted-foreground">
            {words.map((w) => w.userName).join("・")}
          </div>
        </div>
      )}
    </div>
  );
}
