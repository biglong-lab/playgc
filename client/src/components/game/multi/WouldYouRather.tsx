import React from "react";

export interface WouldYouRatherConfig {
  title: string;
  optionA: string;
  emojiA?: string;
  optionB: string;
  emojiB?: string;
  showVoterNames: boolean;
}

export interface WyrVote {
  userId: string;
  userName: string;
  choice: "A" | "B";
  votedAt: number;
}

export interface WouldYouRatherState extends Record<string, unknown> {
  votes: WyrVote[];
  revealed: boolean;
}

interface Props {
  config: WouldYouRatherConfig;
  state: WouldYouRatherState;
  myUserId: string;
  onVote: (choice: "A" | "B") => void;
  onReveal: () => void;
}

export default function WouldYouRather({
  config,
  state,
  myUserId,
  onVote,
  onReveal,
}: Props) {
  const { title, optionA, emojiA, optionB, emojiB, showVoterNames } = config;
  const { votes, revealed } = state;

  const myVote = votes.find((v) => v.userId === myUserId);
  const totalVotes = votes.length;
  const countA = votes.filter((v) => v.choice === "A").length;
  const countB = votes.filter((v) => v.choice === "B").length;
  const pctA = totalVotes > 0 ? Math.round((countA / totalVotes) * 100) : 0;
  const pctB = totalVotes > 0 ? Math.round((countB / totalVotes) * 100) : 0;

  const votersA = votes.filter((v) => v.choice === "A");
  const votersB = votes.filter((v) => v.choice === "B");

  const canReveal = !revealed && votes.length > 0;

  return (
    <div
      data-testid="wyr-root"
      className="flex flex-col gap-4 p-4 max-w-lg mx-auto"
    >
      <h2
        data-testid="wyr-title"
        className="text-xl font-bold text-center"
      >
        {title}
      </h2>

      <div className="flex flex-col gap-3">
        {/* Option A */}
        <button
          data-testid="wyr-option-a"
          onClick={() => !myVote && onVote("A")}
          disabled={!!myVote}
          className={[
            "w-full p-5 rounded-xl border-2 text-left transition-all",
            myVote?.choice === "A"
              ? "border-blue-500 bg-blue-50"
              : myVote
              ? "border-gray-200 bg-gray-50 opacity-60"
              : "border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50 cursor-pointer",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            {emojiA && (
              <span data-testid="wyr-emoji-a" className="text-3xl">
                {emojiA}
              </span>
            )}
            <span
              data-testid="wyr-label-a"
              className="text-base font-semibold"
            >
              {optionA}
            </span>
            {myVote?.choice === "A" && (
              <span data-testid="wyr-my-choice-a" className="ml-auto text-blue-600 font-bold text-sm">
                ✓ 我選這個
              </span>
            )}
          </div>
          {revealed && (
            <div data-testid="wyr-result-a" className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span>{countA} 票</span>
                <span data-testid="wyr-pct-a" className="font-bold text-blue-600">
                  {pctA}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  data-testid="wyr-bar-a"
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${pctA}%` }}
                />
              </div>
              {showVoterNames && votersA.length > 0 && (
                <div
                  data-testid="wyr-voters-a"
                  className="mt-2 flex flex-wrap gap-1"
                >
                  {votersA.map((v) => (
                    <span
                      key={v.userId}
                      data-testid={`wyr-voter-a-${v.userId}`}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                    >
                      {v.userName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </button>

        <div className="text-center text-gray-400 font-bold text-sm">VS</div>

        {/* Option B */}
        <button
          data-testid="wyr-option-b"
          onClick={() => !myVote && onVote("B")}
          disabled={!!myVote}
          className={[
            "w-full p-5 rounded-xl border-2 text-left transition-all",
            myVote?.choice === "B"
              ? "border-rose-500 bg-rose-50"
              : myVote
              ? "border-gray-200 bg-gray-50 opacity-60"
              : "border-rose-300 bg-white hover:border-rose-500 hover:bg-rose-50 cursor-pointer",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            {emojiB && (
              <span data-testid="wyr-emoji-b" className="text-3xl">
                {emojiB}
              </span>
            )}
            <span
              data-testid="wyr-label-b"
              className="text-base font-semibold"
            >
              {optionB}
            </span>
            {myVote?.choice === "B" && (
              <span data-testid="wyr-my-choice-b" className="ml-auto text-rose-600 font-bold text-sm">
                ✓ 我選這個
              </span>
            )}
          </div>
          {revealed && (
            <div data-testid="wyr-result-b" className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span>{countB} 票</span>
                <span data-testid="wyr-pct-b" className="font-bold text-rose-600">
                  {pctB}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  data-testid="wyr-bar-b"
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${pctB}%` }}
                />
              </div>
              {showVoterNames && votersB.length > 0 && (
                <div
                  data-testid="wyr-voters-b"
                  className="mt-2 flex flex-wrap gap-1"
                >
                  {votersB.map((v) => (
                    <span
                      key={v.userId}
                      data-testid={`wyr-voter-b-${v.userId}`}
                      className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full"
                    >
                      {v.userName}
                    </span>
                  ))}
                </div>
          )}
            </div>
          )}
        </button>
      </div>

      {/* Status */}
      <div className="text-center text-sm text-gray-500">
        {!myVote && !revealed && (
          <p data-testid="wyr-hint">點選你的答案</p>
        )}
        {myVote && !revealed && (
          <p data-testid="wyr-voted-msg">
            已投票（共 <span data-testid="wyr-count">{totalVotes}</span> 人）
          </p>
        )}
        {revealed && (
          <p data-testid="wyr-revealed-msg">
            投票結果揭曉（共 <span data-testid="wyr-total">{totalVotes}</span> 票）
          </p>
        )}
      </div>

      {/* Reveal button */}
      {canReveal && (
        <button
          data-testid="wyr-reveal-btn"
          onClick={onReveal}
          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
        >
          揭曉結果
        </button>
      )}

      {/* Waiting hint when no votes yet and not voted */}
      {totalVotes === 0 && !myVote && (
        <p data-testid="wyr-empty" className="text-center text-gray-400 text-sm">
          等待大家投票中…
        </p>
      )}
    </div>
  );
}
