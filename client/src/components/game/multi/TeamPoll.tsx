import React from "react";

export interface PollOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface TeamPollConfig {
  title: string;
  question: string;
  options: PollOption[];
  multiSelect: boolean;
  maxSelections?: number;
  showResults: boolean;
  showVoterNames: boolean;
}

export interface PollVote {
  userId: string;
  userName: string;
  selections: string[];
  votedAt: number;
}

export interface TeamPollState extends Record<string, unknown> {
  votes: PollVote[];
}

interface Props {
  config: TeamPollConfig;
  state: TeamPollState;
  myUserId: string;
  localSelections: string[];
  onToggleSelection: (optionId: string) => void;
  onSubmit: () => void;
}

export default function TeamPoll({
  config,
  state,
  myUserId,
  localSelections,
  onToggleSelection,
  onSubmit,
}: Props) {
  const { title, question, options, multiSelect, maxSelections, showResults, showVoterNames } = config;
  const { votes } = state;

  const myVote = votes.find((v) => v.userId === myUserId);
  const totalVoters = votes.length;
  const totalSelections = votes.reduce((sum, v) => sum + v.selections.length, 0);

  const countFor = (optionId: string) =>
    votes.filter((v) => v.selections.includes(optionId)).length;

  const maxCount = Math.max(...options.map((o) => countFor(o.id)), 1);

  const canSelect =
    !myVote &&
    (!multiSelect ||
      !maxSelections ||
      localSelections.length < maxSelections ||
      localSelections.includes("__sentinel__"));

  const canSubmit = !myVote && localSelections.length > 0;

  return (
    <div data-testid="tp-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="tp-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="tp-question" className="text-sm text-gray-600 text-center">
        {question}
      </p>

      {multiSelect && (
        <p data-testid="tp-multi-hint" className="text-xs text-indigo-500 text-center">
          {maxSelections
            ? `可選 1-${maxSelections} 個選項`
            : "可多選"}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const count = countFor(opt.id);
          const pct = totalSelections > 0 ? Math.round((count / totalVoters) * 100) : 0;
          const isSelected = localSelections.includes(opt.id);
          const myVoted = myVote?.selections.includes(opt.id);
          const isDisabled =
            !!myVote ||
            (!isSelected && !!maxSelections && localSelections.length >= maxSelections);

          return (
            <button
              key={opt.id}
              data-testid={`tp-option-${opt.id}`}
              onClick={() => !myVote && onToggleSelection(opt.id)}
              disabled={isDisabled}
              className={[
                "w-full p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden",
                myVoted
                  ? "border-indigo-500 bg-indigo-50"
                  : isSelected
                  ? "border-indigo-400 bg-indigo-50"
                  : isDisabled
                  ? "border-gray-100 bg-gray-50 opacity-60"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer",
              ].join(" ")}
            >
              {showResults && myVote && (
                <div
                  data-testid={`tp-bar-${opt.id}`}
                  className="absolute inset-0 bg-indigo-100 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {opt.emoji && (
                    <span data-testid={`tp-emoji-${opt.id}`} className="text-xl">
                      {opt.emoji}
                    </span>
                  )}
                  <span data-testid={`tp-label-${opt.id}`} className="font-medium text-sm">
                    {opt.label}
                  </span>
                </div>
                {showResults && myVote && (
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span
                      data-testid={`tp-count-${opt.id}`}
                      className="text-xs text-gray-500"
                    >
                      {count} 票
                    </span>
                    <span
                      data-testid={`tp-pct-${opt.id}`}
                      className="text-xs font-bold text-indigo-600"
                    >
                      {pct}%
                    </span>
                  </div>
                )}
              </div>
              {showVoterNames && myVote && (
                <div
                  data-testid={`tp-voters-${opt.id}`}
                  className="relative mt-1 flex flex-wrap gap-1"
                >
                  {votes
                    .filter((v) => v.selections.includes(opt.id))
                    .map((v) => (
                      <span
                        key={v.userId}
                        data-testid={`tp-voter-${opt.id}-${v.userId}`}
                        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full"
                      >
                        {v.userName}
                      </span>
                    ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!myVote && (
        <button
          data-testid="tp-submit-btn"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          提交
        </button>
      )}

      {myVote && (
        <p data-testid="tp-submitted-msg" className="text-center text-green-600 font-semibold text-sm">
          ✅ 已提交（共 <span data-testid="tp-count-total">{totalVoters}</span> 人投票）
        </p>
      )}

      {totalVoters === 0 && !myVote && (
        <p data-testid="tp-empty" className="text-center text-gray-400 text-sm">
          等待大家投票中…
        </p>
      )}
    </div>
  );
}
