import { useState } from "react";

export interface ClueGuess extends Record<string, unknown> {
  guessId: string;
  userId: string;
  userName: string;
  text: string;
  afterClueCount: number;
  correct: boolean | null;
}

export interface ClueRevealConfig extends Record<string, unknown> {
  title: string;
  clues: string[];
  minCluesBeforeGuess: number;
}

export interface ClueRevealState extends Record<string, unknown> {
  revealedCount: number;
  guesses: ClueGuess[];
  phase: "playing" | "done";
}

const DEFAULT_CONFIG: ClueRevealConfig = {
  title: "解謎線索",
  clues: [],
  minCluesBeforeGuess: 1,
};

interface Props {
  config: ClueRevealConfig;
  state: ClueRevealState;
  myUserId: string;
  onGuess: (text: string) => void;
  onRevealNext: () => void;
  onMarkGuess: (guessId: string, correct: boolean) => void;
  onFinish: () => void;
}

export default function ClueReveal({
  config,
  state,
  myUserId,
  onGuess,
  onRevealNext,
  onMarkGuess,
  onFinish,
}: Props) {
  const [guessInput, setGuessInput] = useState("");

  const { title, clues, minCluesBeforeGuess } = config || DEFAULT_CONFIG;
  const { revealedCount, guesses, phase } = state;

  const revealedClues = clues.slice(0, revealedCount);
  const canGuess = revealedCount >= minCluesBeforeGuess;
  const myGuess = guesses.find((g) => g.userId === myUserId);
  const canRevealNext = revealedCount < clues.length && phase === "playing";

  function handleGuess() {
    if (!guessInput.trim() || myGuess) return;
    onGuess(guessInput.trim());
    setGuessInput("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="cr-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-violet-700">線索</span>
          <span data-testid="cr-revealed-count" className="text-xs text-gray-400">
            {revealedCount} / {clues.length} 條
          </span>
        </div>

        {revealedClues.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">等待主持人公布第一條線索…</p>
        ) : (
          revealedClues.map((clue, idx) => (
            <div
              key={idx}
              data-testid={`cr-clue-${idx}`}
              className="flex gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl"
            >
              <span className="text-violet-500 font-bold text-sm">#{idx + 1}</span>
              <p className="text-sm text-gray-800">{clue}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        {canRevealNext && (
          <button
            data-testid="cr-reveal-next-btn"
            onClick={onRevealNext}
            className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700"
          >
            公布下一條線索
          </button>
        )}
        {phase === "playing" && (
          <button
            data-testid="cr-finish-btn"
            onClick={onFinish}
            className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
          >
            結束遊戲
          </button>
        )}
      </div>

      {phase === "playing" && canGuess && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 text-center">你的答案</p>
          {!myGuess ? (
            <div className="flex gap-2">
              <input
                data-testid="cr-guess-input"
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="輸入你的答案..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                data-testid="cr-guess-submit"
                onClick={handleGuess}
                disabled={!guessInput.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40"
              >
                送出
              </button>
            </div>
          ) : (
            <p data-testid="cr-my-guess" className="text-center text-sm text-gray-500">
              ✅ 已猜：「{myGuess.text}」
              {myGuess.correct === true && " 🎉 答對了！"}
              {myGuess.correct === false && " ❌ 答錯了"}
            </p>
          )}
        </div>
      )}

      {guesses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">所有猜測</p>
          {guesses.length === 0 ? (
            <p data-testid="cr-empty" className="text-xs text-gray-400 text-center">尚無人猜測</p>
          ) : (
            guesses.map((g) => (
              <div
                key={g.guessId}
                data-testid={`cr-guess-${g.guessId}`}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-700">{g.userName}</span>
                  <span className="text-gray-500 ml-2">「{g.text}」</span>
                  <span className="text-xs text-gray-400 ml-1">（線索{g.afterClueCount}）</span>
                </div>
                <div className="flex gap-1">
                  {g.correct === null && (
                    <>
                      <button
                        data-testid={`cr-correct-${g.guessId}`}
                        onClick={() => onMarkGuess(g.guessId, true)}
                        className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        ✓
                      </button>
                      <button
                        data-testid={`cr-wrong-${g.guessId}`}
                        onClick={() => onMarkGuess(g.guessId, false)}
                        className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        ✗
                      </button>
                    </>
                  )}
                  {g.correct === true && <span className="text-green-600 text-sm">🎉</span>}
                  {g.correct === false && <span className="text-red-400 text-sm">❌</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {guesses.length === 0 && phase === "playing" && canGuess && (
        <p data-testid="cr-empty" className="text-xs text-gray-400 text-center">尚無人猜測</p>
      )}
    </div>
  );
}
