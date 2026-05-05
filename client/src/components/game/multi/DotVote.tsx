export interface DotVoteOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface DotVoteConfig {
  title: string;
  question: string;
  options: DotVoteOption[];
  dotsPerPerson: number;
  showResultsLive: boolean;
}

export interface DotAllocation {
  userId: string;
  userName: string;
  allocations: { optionId: string; count: number }[];
  submittedAt: number;
}

export interface DotVoteState extends Record<string, unknown> {
  allocations: DotAllocation[];
}

interface DotVoteProps {
  config: DotVoteConfig;
  state: DotVoteState;
  myUserId: string;
  myUserName?: string;
  /** 本地草稿點數 key=optionId value=count */
  draft: Record<string, number>;
  remainingDots: number;
  onAdd: (optionId: string) => void;
  onRemove: (optionId: string) => void;
  onSubmit: () => void;
}

export default function DotVote({
  config,
  state,
  myUserId,
  myUserName = "玩家",
  draft,
  remainingDots,
  onAdd,
  onRemove,
  onSubmit,
}: DotVoteProps) {
  const myAllocation = state.allocations.find((a) => a.userId === myUserId);
  const hasSubmitted = !!myAllocation;

  const getTotalDots = (optionId: string) =>
    state.allocations.reduce((sum, a) => {
      const entry = a.allocations.find((x) => x.optionId === optionId);
      return sum + (entry?.count ?? 0);
    }, 0);

  const totalVoters = state.allocations.length;

  return (
    <div data-testid="dot-vote-root" className="p-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 data-testid="dot-vote-title" className="text-xl font-bold text-slate-800">
          {config.title}
        </h2>
        <p data-testid="dot-vote-question" className="text-sm text-slate-500 mt-1">
          {config.question}
        </p>
      </div>

      <div data-testid="participant-count" className="flex items-center gap-2 text-sm text-slate-500">
        <span>👥 已投票</span>
        <span className="font-semibold text-indigo-600">{totalVoters}</span>
        <span>人</span>
      </div>

      {!hasSubmitted && (
        <div data-testid="remaining-dots" className="p-3 bg-indigo-50 rounded-xl text-sm text-indigo-700">
          剩餘點數：<strong>{remainingDots}</strong> / {config.dotsPerPerson}
        </div>
      )}

      {hasSubmitted && (
        <div data-testid="already-submitted" className="p-3 bg-green-50 rounded-xl text-sm text-green-700 text-center">
          ✅ 已提交！等待其他人投票
        </div>
      )}

      <div className="space-y-2">
        {config.options.map((opt) => {
          const localCount = hasSubmitted
            ? (myAllocation?.allocations.find((a) => a.optionId === opt.id)?.count ?? 0)
            : (draft[opt.id] ?? 0);

          return (
            <div key={opt.id} data-testid={`dot-option-${opt.id}`} className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
                  <span className="font-medium text-slate-800 text-sm">{opt.label}</span>
                </div>
                {!hasSubmitted && (
                  <div className="flex items-center gap-2">
                    <button
                      data-testid={`remove-dot-${opt.id}`}
                      onClick={() => onRemove(opt.id)}
                      disabled={localCount === 0}
                      className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-sm disabled:opacity-30 hover:bg-slate-300 transition"
                    >
                      −
                    </button>
                    <span data-testid={`local-count-${opt.id}`} className="w-5 text-center font-bold text-slate-700 text-sm">
                      {localCount}
                    </span>
                    <button
                      data-testid={`add-dot-${opt.id}`}
                      onClick={() => onAdd(opt.id)}
                      disabled={remainingDots <= 0}
                      className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm disabled:opacity-30 hover:bg-indigo-200 transition"
                    >
                      ＋
                    </button>
                  </div>
                )}
              </div>

              {(config.showResultsLive || hasSubmitted) && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      data-testid={`option-bar-${opt.id}`}
                      className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          totalVoters > 0
                            ? Math.min((getTotalDots(opt.id) / (totalVoters * config.dotsPerPerson)) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span data-testid={`total-dots-${opt.id}`} className="text-xs font-semibold text-slate-500 w-8 text-right">
                    {getTotalDots(opt.id)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasSubmitted && (
        <button
          data-testid="submit-dots-btn"
          onClick={onSubmit}
          disabled={remainingDots !== 0}
          className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition disabled:opacity-40"
        >
          {remainingDots === 0 ? "提交分配" : `還剩 ${remainingDots} 點（分配完才能提交）`}
        </button>
      )}

      {hasSubmitted && (
        <div data-testid="submitted-msg" className="text-xs text-center text-slate-400">
          {myUserName} 已分配完畢
        </div>
      )}
    </div>
  );
}
