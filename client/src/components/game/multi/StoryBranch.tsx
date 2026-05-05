export interface StoryChoice extends Record<string, unknown> {
  choiceId: string;
  label: string;
  nextSegmentId: string | null;
}

export interface StorySegment extends Record<string, unknown> {
  segmentId: string;
  text: string;
  choices: StoryChoice[];
}

export interface BranchVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  choiceId: string;
  segmentId: string;
}

export interface StoryBranchConfig extends Record<string, unknown> {
  title: string;
  segments: StorySegment[];
}

export interface StoryBranchState extends Record<string, unknown> {
  currentSegmentId: string | null;
  votes: BranchVote[];
  history: string[];
  phase: "voting" | "result" | "done";
}

const DEFAULT_CONFIG: StoryBranchConfig = {
  title: "故事分支",
  segments: [],
};

interface Props {
  config: StoryBranchConfig;
  state: StoryBranchState;
  myUserId: string;
  onVote: (choiceId: string) => void;
  onAdvance: (nextSegmentId: string | null) => void;
  onStart: () => void;
}

export default function StoryBranch({
  config,
  state,
  myUserId,
  onVote,
  onAdvance,
  onStart,
}: Props) {
  const segments = config.segments ?? DEFAULT_CONFIG.segments;
  const { currentSegmentId, votes, history, phase } = state;
  const title = config.title || DEFAULT_CONFIG.title;

  const currentSegment = segments.find((s) => s.segmentId === currentSegmentId) ?? null;
  const currentVotes = votes.filter((v) => v.segmentId === currentSegmentId);
  const myVote = currentVotes.find((v) => v.userId === myUserId);

  const voteCounts: Record<string, number> = {};
  for (const v of currentVotes) {
    voteCounts[v.choiceId] = (voteCounts[v.choiceId] ?? 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(voteCounts), 1);
  const winnerChoiceId =
    phase === "result" && currentSegment
      ? (currentSegment.choices.sort(
          (a, b) => (voteCounts[b.choiceId] ?? 0) - (voteCounts[a.choiceId] ?? 0)
        )[0]?.choiceId ?? null)
      : null;

  const winnerChoice = currentSegment?.choices.find((c) => c.choiceId === winnerChoiceId);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="sb-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="sb-phase"
        className="text-center text-xs font-medium text-violet-600"
      >
        {phase === "voting"
          ? "🗳️ 投票中"
          : phase === "result"
          ? "📊 揭曉結果"
          : "🏁 故事結束"}
      </p>

      {segments.length === 0 && (
        <p data-testid="sb-empty" className="text-center text-gray-400 py-8">
          尚未設定故事段落
        </p>
      )}

      {segments.length > 0 && phase === "voting" && !currentSegmentId && (
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-500">故事尚未開始</p>
          <button
            data-testid="sb-start-btn"
            onClick={onStart}
            className="px-8 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700"
          >
            開始故事
          </button>
        </div>
      )}

      {currentSegment && (
        <div className="space-y-4">
          <div
            data-testid="sb-segment-text"
            className="p-4 bg-violet-50 rounded-xl text-sm leading-relaxed"
          >
            {currentSegment.text}
          </div>

          {history.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
              第 {history.length + 1} 段 / 共 {segments.length} 段
            </p>
          )}

          {phase === "voting" && (
            <div className="space-y-2">
              <p className="text-xs text-center text-gray-400">選擇故事走向</p>
              {currentSegment.choices.map((choice) => {
                const count = voteCounts[choice.choiceId] ?? 0;
                const isMyVote = myVote?.choiceId === choice.choiceId;
                return (
                  <button
                    key={choice.choiceId}
                    data-testid={`sb-choice-${choice.choiceId}`}
                    onClick={() => !myVote && onVote(choice.choiceId)}
                    disabled={!!myVote}
                    className={`w-full p-3 rounded-xl border-2 text-left text-sm transition-all ${
                      isMyVote
                        ? "border-violet-400 bg-violet-50"
                        : "border-gray-200 bg-white hover:border-violet-200 disabled:cursor-default"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {choice.label}
                        {isMyVote && " ✓"}
                      </span>
                      <span
                        data-testid={`sb-vote-count-${choice.choiceId}`}
                        className="text-xs text-gray-400"
                      >
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-center text-gray-400">
                已有 <span data-testid="sb-total-votes">{currentVotes.length}</span> 人投票
              </p>
              <div className="text-center">
                <button
                  data-testid="sb-reveal-btn"
                  onClick={() => onAdvance(currentSegmentId)}
                  className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
                >
                  揭曉結果
                </button>
              </div>
            </div>
          )}

          {phase === "result" && winnerChoice && (
            <div className="space-y-3">
              <div
                data-testid="sb-winner-choice"
                className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-xl text-center"
              >
                <p className="text-xs text-yellow-600 mb-1">🏆 多數選擇</p>
                <p className="font-bold text-yellow-800">{winnerChoice.label}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {voteCounts[winnerChoiceId!] ?? 0} 票（共 {currentVotes.length} 人）
                </p>
              </div>
              <div className="space-y-1">
                {currentSegment.choices.map((choice) => {
                  const count = voteCounts[choice.choiceId] ?? 0;
                  const pct = Math.round((count / maxVotes) * 100);
                  return (
                    <div
                      key={choice.choiceId}
                      data-testid={`sb-result-${choice.choiceId}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-24 shrink-0 truncate">{choice.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-gray-500">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-center">
                <button
                  data-testid="sb-next-btn"
                  onClick={() => onAdvance(winnerChoice.nextSegmentId)}
                  className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700"
                >
                  {winnerChoice.nextSegmentId ? "繼續故事" : "結束故事"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div data-testid="sb-done" className="text-center py-8 space-y-2">
          <p className="text-2xl">🎉</p>
          <p className="font-bold text-violet-700">故事完結</p>
          <p className="text-xs text-gray-400">
            經歷了 {history.length} 個段落
          </p>
        </div>
      )}
    </div>
  );
}
