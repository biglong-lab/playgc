import { useMemo } from "react";
import { ThumbsUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface IdeaWallConfig {
  title: string;
  prompt?: string;
  placeholder?: string;
  maxLength: number;
  maxIdeasPerPerson: number;
  showAuthor: boolean;
  allowVoteOwn: boolean;
}

export interface IdeaCard {
  id: string;
  userId: string;
  userName: string;
  text: string;
  emoji?: string;
  votes: string[];
  addedAt: number;
}

export interface IdeaWallState extends Record<string, unknown> {
  ideas: IdeaCard[];
}

interface Props {
  config: IdeaWallConfig;
  state: IdeaWallState;
  myUserId: string;
  draftText: string;
  draftEmoji: string;
  onTextChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onAdd: () => void;
  onVote: (ideaId: string) => void;
}

const QUICK_EMOJIS = ["💡", "🚀", "🎯", "🌟", "🔥", "🎉", "🤔", "⚡", "🌈", "🎨"];

export default function IdeaWall({
  config,
  state,
  myUserId,
  draftText,
  draftEmoji,
  onTextChange,
  onEmojiChange,
  onAdd,
  onVote,
}: Props) {
  const {
    title,
    prompt = "分享你的點子",
    placeholder = "寫下你的想法…",
    maxLength,
    maxIdeasPerPerson,
    showAuthor,
    allowVoteOwn,
  } = config;

  const { ideas } = state;

  const myIdeasCount = ideas.filter((i) => i.userId === myUserId).length;
  const canAdd = myIdeasCount < maxIdeasPerPerson && draftText.trim().length > 0;

  const sortedIdeas = useMemo(
    () => [...ideas].sort((a, b) => b.votes.length - a.votes.length || a.addedAt - b.addedAt),
    [ideas],
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-6 gap-4" data-testid="idea-wall-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="idea-title">{title}</h1>
        <p className="text-gray-500 text-sm mt-1" data-testid="idea-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400">
        <span data-testid="idea-count">{ideas.length}</span> 個想法 · 我已送出{" "}
        <span data-testid="my-idea-count">{myIdeasCount}</span>/{maxIdeasPerPerson}
      </div>

      {/* Add form */}
      {myIdeasCount < maxIdeasPerPerson && (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3" data-testid="add-idea-form">
          {/* Emoji selector */}
          <div className="flex gap-2 flex-wrap">
            {QUICK_EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => onEmojiChange(em)}
                className={`text-xl p-1 rounded-lg transition-all ${
                  draftEmoji === em ? "bg-blue-100 ring-2 ring-blue-400 scale-110" : "hover:bg-gray-100"
                }`}
                data-testid={`idea-emoji-${em}`}
              >
                {em}
              </button>
            ))}
          </div>

          <Textarea
            value={draftText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={2}
            className="resize-none"
            data-testid="idea-text-input"
          />

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{maxLength - draftText.length} 字</span>
            <Button
              onClick={onAdd}
              disabled={!canAdd}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="add-idea-btn"
            >
              <Send className="w-4 h-4 mr-1" />
              提交
            </Button>
          </div>
        </div>
      )}

      {/* Max reached message */}
      {myIdeasCount >= maxIdeasPerPerson && (
        <div className="text-center text-sm text-gray-400 bg-white rounded-xl py-3" data-testid="max-ideas-reached">
          你的點子已達上限
        </div>
      )}

      {/* Ideas list */}
      {ideas.length === 0 ? (
        <div className="text-center text-gray-400 py-8" data-testid="empty-ideas">
          還沒有點子，第一個分享吧！
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="idea-list">
          {sortedIdeas.map((idea, rank) => {
            const hasVoted = idea.votes.includes(myUserId);
            const isOwn = idea.userId === myUserId;
            const canVote = !isOwn || allowVoteOwn;
            return (
              <div
                key={idea.id}
                className={`bg-white rounded-2xl shadow p-4 flex items-start gap-3 ${
                  rank === 0 && ideas.length > 1 ? "ring-2 ring-yellow-300" : ""
                }`}
                data-testid={`idea-${idea.id}`}
              >
                {/* Rank */}
                <div className="text-lg font-bold text-gray-300 w-6 text-center" data-testid={`idea-rank-${idea.id}`}>
                  {rank + 1}
                </div>

                {/* Content */}
                <div className="flex-1">
                  {idea.emoji && (
                    <span className="text-xl mr-1" data-testid={`idea-emoji-display-${idea.id}`}>{idea.emoji}</span>
                  )}
                  <span className="text-gray-800 font-medium" data-testid={`idea-text-${idea.id}`}>{idea.text}</span>
                  {showAuthor && (
                    <div className="text-xs text-gray-400 mt-1" data-testid={`idea-author-${idea.id}`}>
                      {isOwn ? "我的點子" : idea.userName}
                    </div>
                  )}
                </div>

                {/* Vote button */}
                <button
                  onClick={() => onVote(idea.id)}
                  disabled={!canVote}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${
                    hasVoted
                      ? "text-blue-500 bg-blue-50"
                      : "text-gray-400 hover:text-blue-400 hover:bg-blue-50"
                  } disabled:opacity-40 disabled:cursor-default`}
                  data-testid={`vote-btn-${idea.id}`}
                >
                  <ThumbsUp className={`w-5 h-5 ${hasVoted ? "fill-blue-500" : ""}`} />
                  <span className="text-xs font-bold" data-testid={`vote-count-${idea.id}`}>{idea.votes.length}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
