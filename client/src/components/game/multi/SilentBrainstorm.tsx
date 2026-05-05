import React from "react";

export interface SilentBrainstormConfig {
  title: string;
  question: string;
  maxLength: number;
  maxIdeasPerPerson: number;
  showAuthor: boolean;
}

export interface BrainIdea {
  ideaId: string;
  userId: string;
  userName: string;
  content: string;
  votes: string[]; // userIds who voted
}

export interface SilentBrainstormState extends Record<string, unknown> {
  ideas: BrainIdea[];
  revealed: boolean;
}

interface Props {
  config: SilentBrainstormConfig;
  state: SilentBrainstormState;
  myUserId: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
  onVote: (ideaId: string) => void;
}

export default function SilentBrainstorm({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
  onReveal,
  onVote,
}: Props) {
  const { title, question, maxLength, maxIdeasPerPerson, showAuthor } = config;
  const { ideas, revealed } = state;

  const myIdeas = ideas.filter((i) => i.userId === myUserId);
  const canSubmit = myIdeas.length < maxIdeasPerPerson && draftText.trim().length > 0;
  const charsLeft = maxLength - draftText.length;

  // 已揭曉：按票數排序
  const sortedIdeas = [...ideas].sort((a, b) => b.votes.length - a.votes.length);

  return (
    <div data-testid="sb-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="sb-title" className="text-lg font-bold">{title}</h2>

      <div data-testid="sb-question" className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
        <p className="font-semibold text-blue-800 text-sm">{question}</p>
      </div>

      {/* 輸入區（揭曉前可提交，未超上限） */}
      {!revealed && myIdeas.length < maxIdeasPerPerson && (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="sb-input"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={maxLength}
            rows={3}
            placeholder="寫下你的想法…"
            className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm resize-none focus:border-blue-400 focus:outline-none"
          />
          <div className="flex justify-between items-center">
            <span data-testid="sb-chars-left" className="text-xs text-gray-400">
              還可輸入 {charsLeft} 字
            </span>
            <button
              data-testid="sb-submit-btn"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              提交想法
            </button>
          </div>
        </div>
      )}

      {/* 已達上限提示 */}
      {!revealed && myIdeas.length >= maxIdeasPerPerson && (
        <p data-testid="sb-limit-msg" className="text-center text-green-600 text-sm font-semibold">
          ✅ 已提交 {myIdeas.length} 個想法（上限）
        </p>
      )}

      {/* 揭曉前狀態 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="sb-count">
              {ideas.length}
            </span> 個想法已提交（所有人提交前無法看到）
          </p>
          <button
            data-testid="sb-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors"
          >
            全部揭曉
          </button>
        </div>
      )}

      {/* 揭曉後：顯示所有想法並可投票 */}
      {revealed && (
        <div data-testid="sb-ideas" className="flex flex-col gap-3">
          <p className="text-center text-purple-600 text-sm font-semibold">
            💡 共 {ideas.length} 個想法，為你最支持的點讚！
          </p>
          {sortedIdeas.length === 0 ? (
            <p data-testid="sb-empty" className="text-center text-gray-400 text-sm py-4">還沒有人提交想法</p>
          ) : (
            sortedIdeas.map((idea) => {
              const myVoted = idea.votes.includes(myUserId);
              return (
                <div
                  key={idea.ideaId}
                  data-testid={`sb-idea-${idea.ideaId}`}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm flex gap-3 items-start"
                >
                  <div className="flex-1">
                    {showAuthor && (
                      <p data-testid={`sb-author-${idea.ideaId}`} className="text-xs font-semibold text-gray-500 mb-1">
                        {idea.userName}
                      </p>
                    )}
                    <p data-testid={`sb-content-${idea.ideaId}`} className="text-sm text-gray-700">
                      {idea.content}
                    </p>
                  </div>
                  <button
                    data-testid={`sb-vote-${idea.ideaId}`}
                    onClick={() => onVote(idea.ideaId)}
                    className={[
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors",
                      myVoted
                        ? "bg-yellow-100 text-yellow-600 border-2 border-yellow-400"
                        : "bg-gray-50 text-gray-400 border border-gray-200 hover:border-yellow-300",
                    ].join(" ")}
                  >
                    <span>👍</span>
                    <span data-testid={`sb-vote-count-${idea.ideaId}`}>{idea.votes.length}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
