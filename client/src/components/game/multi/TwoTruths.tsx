export interface PlayerStatements {
  userId: string;
  userName: string;
  statements: string[];
  lieIdx: number;
  submittedAt: number;
}

export interface TwoTruthsGuess {
  guesserId: string;
  targetUserId: string;
  guessedIdx: number;
}

export interface TwoTruthsConfig {
  title: string;
  instructions?: string;
  showScores: boolean;
}

export interface TwoTruthsState extends Record<string, unknown> {
  phase: "collect" | "guess" | "reveal";
  entries: PlayerStatements[];
  guesses: TwoTruthsGuess[];
  hostUserId: string | null;
}

interface CollectFormProps {
  drafts: string[];
  lieDraftIdx: number;
  onDraftChange: (idx: number, value: string) => void;
  onLieSelect: (idx: number) => void;
  onSubmit: () => void;
  hasSubmitted: boolean;
}

function CollectForm({ drafts, lieDraftIdx, onDraftChange, onLieSelect, onSubmit, hasSubmitted }: CollectFormProps) {
  const canSubmit = drafts.every((d) => d.trim().length > 0);

  if (hasSubmitted) {
    return (
      <div data-testid="submitted-msg" className="p-4 bg-green-50 rounded-xl text-sm text-green-700 text-center">
        ✅ 已提交！等待其他人完成…
      </div>
    );
  }

  return (
    <div data-testid="collect-form" className="space-y-3">
      <p className="text-xs text-slate-500">輸入 2 個真實陳述 + 1 個謊言，然後標記哪個是謊言</p>
      {drafts.map((text, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <button
            data-testid={`lie-select-${idx}`}
            onClick={() => onLieSelect(idx)}
            className={`flex-shrink-0 w-8 h-8 rounded-full text-sm font-bold transition ${
              lieDraftIdx === idx
                ? "bg-red-500 text-white"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
            title="標記為謊言"
          >
            {lieDraftIdx === idx ? "🤥" : idx + 1}
          </button>
          <input
            data-testid={`statement-input-${idx}`}
            type="text"
            value={text}
            onChange={(e) => onDraftChange(idx, e.target.value)}
            placeholder={idx === lieDraftIdx ? "謊言陳述…" : "真實陳述…"}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition ${
              idx === lieDraftIdx
                ? "border-red-300 focus:ring-red-300 bg-red-50"
                : "border-slate-200 focus:ring-indigo-300 bg-white"
            }`}
            maxLength={50}
          />
        </div>
      ))}
      <p className="text-xs text-slate-400">紅色 🤥 = 謊言，點擊數字按鈕切換</p>
      <button
        data-testid="submit-statements-btn"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-2 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-40"
      >
        提交陳述
      </button>
    </div>
  );
}

interface GuessCardProps {
  entry: PlayerStatements;
  myGuess: number | undefined;
  onGuess: (targetUserId: string, idx: number) => void;
  isMe: boolean;
}

function GuessCard({ entry, myGuess, onGuess, isMe }: GuessCardProps) {
  return (
    <div data-testid={`guess-card-${entry.userId}`} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
      <p className="text-sm font-semibold text-slate-700">
        {entry.userName} 的三個陳述：
        {isMe && <span className="ml-2 text-xs text-slate-400">（這是你的）</span>}
      </p>
      <div className="space-y-1">
        {entry.statements.map((stmt, idx) => (
          <button
            key={idx}
            data-testid={`guess-btn-${entry.userId}-${idx}`}
            onClick={() => !isMe && onGuess(entry.userId, idx)}
            disabled={isMe}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
              myGuess === idx
                ? "bg-indigo-100 border border-indigo-400 font-semibold"
                : "bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:cursor-default"
            }`}
          >
            {idx + 1}. {stmt}
            {myGuess === idx && <span className="ml-2 text-indigo-500 text-xs">← 你的猜測</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TwoTruthsProps {
  config: TwoTruthsConfig;
  state: TwoTruthsState;
  myUserId: string;
  drafts: string[];
  lieDraftIdx: number;
  onDraftChange: (idx: number, value: string) => void;
  onLieSelect: (idx: number) => void;
  onSubmit: () => void;
  onGuess: (targetUserId: string, idx: number) => void;
  onAdvancePhase: () => void;
}

export default function TwoTruths({
  config,
  state,
  myUserId,
  drafts,
  lieDraftIdx,
  onDraftChange,
  onLieSelect,
  onSubmit,
  onGuess,
  onAdvancePhase,
}: TwoTruthsProps) {
  const myEntry = state.entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;
  const isHost = state.hostUserId === myUserId || state.entries[0]?.userId === myUserId;

  const getMyGuess = (targetUserId: string) =>
    state.guesses.find((g) => g.guesserId === myUserId && g.targetUserId === targetUserId)?.guessedIdx;

  const getScore = (userId: string) => {
    const entry = state.entries.find((e) => e.userId === userId);
    if (!entry) return 0;
    return state.guesses.filter((g) => g.targetUserId === userId && g.guessedIdx === entry.lieIdx).length;
  };

  return (
    <div data-testid="two-truths-root" className="p-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 data-testid="two-truths-title" className="text-xl font-bold text-slate-800">
          {config.title}
        </h2>
        {config.instructions && (
          <p data-testid="two-truths-instructions" className="text-sm text-slate-500 mt-1">
            {config.instructions}
          </p>
        )}
      </div>

      <div data-testid="player-count" className="text-sm text-slate-500">
        已提交：<span className="font-semibold text-indigo-600">{state.entries.length}</span> 人
      </div>

      {/* 收集階段 */}
      {state.phase === "collect" && (
        <div data-testid="collect-phase">
          <CollectForm
            drafts={drafts}
            lieDraftIdx={lieDraftIdx}
            onDraftChange={onDraftChange}
            onLieSelect={onLieSelect}
            onSubmit={onSubmit}
            hasSubmitted={hasSubmitted}
          />
          {hasSubmitted && isHost && state.entries.length >= 2 && (
            <button
              data-testid="advance-to-guess-btn"
              onClick={onAdvancePhase}
              className="mt-3 w-full py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
            >
              開始猜謊！（{state.entries.length} 人已提交）
            </button>
          )}
        </div>
      )}

      {/* 猜測階段 */}
      {state.phase === "guess" && (
        <div data-testid="guess-phase" className="space-y-3">
          <p className="text-sm text-indigo-600 font-medium">選出你認為是謊言的陳述 👆</p>
          {state.entries.map((entry) => (
            <GuessCard
              key={entry.userId}
              entry={entry}
              myGuess={getMyGuess(entry.userId)}
              onGuess={onGuess}
              isMe={entry.userId === myUserId}
            />
          ))}
          {isHost && (
            <button
              data-testid="advance-to-reveal-btn"
              onClick={onAdvancePhase}
              className="w-full py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition"
            >
              揭曉答案！
            </button>
          )}
        </div>
      )}

      {/* 揭曉階段 */}
      {state.phase === "reveal" && (
        <div data-testid="reveal-phase" className="space-y-3">
          <p className="text-sm text-rose-600 font-bold text-center">🎭 真相大揭露！</p>
          {state.entries.map((entry) => {
            const myGuessIdx = getMyGuess(entry.userId);
            const guessedCorrectly = myGuessIdx === entry.lieIdx;
            const totalCorrect = state.guesses.filter(
              (g) => g.targetUserId === entry.userId && g.guessedIdx === entry.lieIdx,
            ).length;

            return (
              <div
                key={entry.userId}
                data-testid={`reveal-card-${entry.userId}`}
                className="p-3 bg-white rounded-xl border border-slate-200 space-y-2"
              >
                <p className="text-sm font-semibold text-slate-700">{entry.userName} 的謊言是：</p>
                <div className="space-y-1">
                  {entry.statements.map((stmt, idx) => (
                    <div
                      key={idx}
                      data-testid={`reveal-stmt-${entry.userId}-${idx}`}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        idx === entry.lieIdx
                          ? "bg-red-100 border border-red-400 font-semibold text-red-700"
                          : "bg-green-50 border border-green-200 text-green-700"
                      }`}
                    >
                      {idx + 1}. {stmt}
                      {idx === entry.lieIdx && <span className="ml-2">🤥 謊言！</span>}
                    </div>
                  ))}
                </div>
                {entry.userId !== myUserId && (
                  <p
                    data-testid={`my-result-${entry.userId}`}
                    className={`text-xs text-center py-1 rounded ${guessedCorrectly ? "text-green-600" : "text-slate-400"}`}
                  >
                    {guessedCorrectly ? "✅ 你猜對了！" : myGuessIdx !== undefined ? "❌ 猜錯了" : "（未作答）"}
                  </p>
                )}
                {config.showScores && (
                  <p data-testid={`score-${entry.userId}`} className="text-xs text-center text-slate-400">
                    共 {totalCorrect} 人識破謊言
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
