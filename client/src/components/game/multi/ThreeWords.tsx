import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WordEntry {
  entryId: string;
  userId: string;
  userName: string;
  words: [string, string, string];
}

interface ThreeWordsState extends Record<string, unknown> {
  entries: WordEntry[];
  revealed: boolean;
}

interface ThreeWordsConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): ThreeWordsConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "三個字",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "用三個字描述此刻的你，或這個團隊",
  };
}

const WORD_COLORS = [
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
];

const DEFAULT_STATE: ThreeWordsState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ThreeWords({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ThreeWordsState>({
    gameId,
    sessionId,
    pageId,
    type: "three_words",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [w1, setW1] = useState("");
  const [w2, setW2] = useState("");
  const [w3, setW3] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tw-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit =
    w1.trim().length >= 1 && w2.trim().length >= 1 && w3.trim().length >= 1;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: WordEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      words: [w1.trim(), w2.trim(), w3.trim()],
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setW1("");
    setW2("");
    setW3("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const total = state.entries.length;
  const allWords = state.entries.flatMap((e) => e.words);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-violet-500" />
        <h2 className="text-xl font-bold" data-testid="tw-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tw-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="tw-count">
        已提交：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="tw-form" className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">第一個字</label>
              <input
                data-testid="tw-word1"
                value={w1}
                onChange={(e) => setW1(e.target.value)}
                placeholder="字詞一"
                className="w-full p-2 border rounded text-sm text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">第二個字</label>
              <input
                data-testid="tw-word2"
                value={w2}
                onChange={(e) => setW2(e.target.value)}
                placeholder="字詞二"
                className="w-full p-2 border rounded text-sm text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">第三個字</label>
              <input
                data-testid="tw-word3"
                value={w3}
                onChange={(e) => setW3(e.target.value)}
                placeholder="字詞三"
                className="w-full p-2 border rounded text-sm text-center"
              />
            </div>
          </div>
          <button
            data-testid="tw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-violet-500 text-white rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出三個字
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-violet-50 rounded border border-violet-200 text-sm"
          data-testid="tw-my-entry"
        >
          <p className="text-xs text-violet-600 font-medium mb-2">你的三個字</p>
          <div className="flex gap-2">
            {myEntry.words.map((w, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-violet-200 text-violet-800 rounded-full text-sm font-bold"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tw-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-violet-500 text-white rounded text-sm"
        >
          揭示全隊字詞牆
        </button>
      )}

      {state.revealed && (
        <div data-testid="tw-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">
            💬 全隊字詞牆（{allWords.length} 個字）
          </p>
          {total === 0 ? (
            <p data-testid="tw-empty" className="text-gray-400 text-sm">
              尚無字詞
            </p>
          ) : (
            <>
              <div data-testid="tw-word-wall" className="flex flex-wrap gap-2">
                {state.entries.map((e, ei) =>
                  e.words.map((w, wi) => (
                    <span
                      key={`${e.entryId}-${wi}`}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border ${WORD_COLORS[(ei * 3 + wi) % WORD_COLORS.length]}`}
                    >
                      {w}
                    </span>
                  )),
                )}
              </div>

              <div data-testid="tw-member-list" className="space-y-1.5 pt-2 border-t">
                {state.entries.map((e) => (
                  <div
                    key={e.entryId}
                    data-testid={`tw-card-${e.entryId}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-gray-500 min-w-[4rem]">{e.userName}</span>
                    <div className="flex gap-1">
                      {e.words.map((w, i) => (
                        <span key={i} className="text-gray-700 font-medium">
                          {w}
                          {i < 2 ? "・" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ThreeWords;
