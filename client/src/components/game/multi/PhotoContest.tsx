import { useMemo } from "react";
import { Trophy, ThumbsUp, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface PhotoContestConfig {
  title: string;
  prompt?: string;
  theme?: string;
  maxPhotosPerPerson: number;
  allowVoteOwn: boolean;
  showAuthor: boolean;
  maxCaptionLength: number;
}

export interface ContestEntry {
  id: string;
  userId: string;
  userName: string;
  caption: string;
  imageUrl?: string;
  votes: string[];
  submittedAt: number;
}

export interface PhotoContestState extends Record<string, unknown> {
  entries: ContestEntry[];
  phase: "submit" | "vote" | "result";
}

interface Props {
  config: PhotoContestConfig;
  state: PhotoContestState;
  myUserId: string;
  draftCaption: string;
  draftImageUrl: string;
  onCaptionChange: (v: string) => void;
  onImageUrlChange: (v: string) => void;
  onSubmit: () => void;
  onVote: (entryId: string) => void;
}

export default function PhotoContest({
  config,
  state,
  myUserId,
  draftCaption,
  draftImageUrl,
  onCaptionChange,
  onImageUrlChange,
  onSubmit,
  onVote,
}: Props) {
  const {
    title,
    prompt = "上傳你的最佳作品！",
    theme,
    maxPhotosPerPerson,
    allowVoteOwn,
    showAuthor,
    maxCaptionLength,
  } = config;

  const { entries, phase } = state;

  const myEntries = entries.filter((e) => e.userId === myUserId);
  const canSubmit = myEntries.length < maxPhotosPerPerson && draftCaption.trim().length > 0;

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.votes.length - a.votes.length || a.submittedAt - b.submittedAt),
    [entries],
  );

  const topEntryId = sortedEntries[0]?.id;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-6 gap-4" data-testid="photo-contest-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="pc-title">{title}</h1>
        {theme && (
          <div className="inline-block bg-yellow-100 text-yellow-700 text-sm px-3 py-1 rounded-full mt-1" data-testid="pc-theme">
            主題：{theme}
          </div>
        )}
        <p className="text-gray-500 text-sm mt-1" data-testid="pc-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400">
        <span data-testid="pc-entry-count">{entries.length}</span> 件作品 · 我已送出{" "}
        <span data-testid="pc-my-count">{myEntries.length}</span>/{maxPhotosPerPerson}
      </div>

      {/* Submit form */}
      {phase === "submit" && myEntries.length < maxPhotosPerPerson && (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3" data-testid="pc-submit-form">
          <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
            <Camera className="w-4 h-4" />
            送出作品
          </div>

          <Textarea
            value={draftCaption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder="寫下圖片說明或描述…"
            maxLength={maxCaptionLength}
            rows={2}
            className="resize-none"
            data-testid="pc-caption-input"
          />

          <input
            type="url"
            value={draftImageUrl}
            onChange={(e) => onImageUrlChange(e.target.value)}
            placeholder="貼上圖片連結（選填）"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            data-testid="pc-image-url-input"
          />

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{maxCaptionLength - draftCaption.length} 字</span>
            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="pc-submit-btn"
            >
              送出
            </Button>
          </div>
        </div>
      )}

      {phase === "submit" && myEntries.length >= maxPhotosPerPerson && (
        <div className="text-center text-sm text-gray-400 bg-white rounded-xl py-3" data-testid="pc-max-reached">
          已達送出上限，等待投票開始
        </div>
      )}

      {/* Vote phase reminder */}
      {phase === "vote" && (
        <div className="text-center bg-blue-50 text-blue-600 text-sm rounded-xl py-2 font-medium" data-testid="pc-vote-phase-msg">
          投票進行中！點擊喜歡的作品投票
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && (
        <div className="text-center bg-yellow-50 text-yellow-700 text-sm rounded-xl py-2 font-medium flex items-center justify-center gap-2" data-testid="pc-result-phase-msg">
          <Trophy className="w-4 h-4" />
          投票結果揭曉！
        </div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="text-center text-gray-400 py-8" data-testid="pc-empty">
          還沒有作品，第一個上傳吧！
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="pc-entry-list">
          {sortedEntries.map((entry, rank) => {
            const isOwn = entry.userId === myUserId;
            const hasVoted = entry.votes.includes(myUserId);
            const canVote = (phase === "vote" || phase === "result") && (!isOwn || allowVoteOwn);
            const isTop = phase === "result" && entry.id === topEntryId && entries.length > 1;

            return (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl shadow p-4 flex gap-3 ${isTop ? "ring-2 ring-yellow-300" : ""}`}
                data-testid={`pc-entry-${entry.id}`}
              >
                {/* Rank */}
                <div className="text-lg font-bold text-gray-300 w-6 text-center shrink-0" data-testid={`pc-rank-${entry.id}`}>
                  {phase === "result" ? (rank + 1) : "·"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {entry.imageUrl && (
                    <img
                      src={entry.imageUrl}
                      alt="作品"
                      className="w-full rounded-lg mb-2 max-h-48 object-cover"
                      data-testid={`pc-image-${entry.id}`}
                    />
                  )}
                  <p className="text-gray-800 text-sm" data-testid={`pc-caption-${entry.id}`}>{entry.caption}</p>
                  {showAuthor && (
                    <p className="text-xs text-gray-400 mt-1" data-testid={`pc-author-${entry.id}`}>
                      {isOwn ? "我的作品" : entry.userName}
                    </p>
                  )}
                  {isTop && (
                    <div className="flex items-center gap-1 text-yellow-600 text-xs mt-1" data-testid={`pc-winner-${entry.id}`}>
                      <Trophy className="w-3 h-3" /> 冠軍
                    </div>
                  )}
                </div>

                {/* Vote button */}
                <button
                  onClick={() => onVote(entry.id)}
                  disabled={!canVote}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors shrink-0 ${
                    hasVoted
                      ? "text-blue-500 bg-blue-50"
                      : "text-gray-400 hover:text-blue-400 hover:bg-blue-50"
                  } disabled:opacity-40 disabled:cursor-default`}
                  data-testid={`pc-vote-btn-${entry.id}`}
                >
                  <ThumbsUp className={`w-5 h-5 ${hasVoted ? "fill-blue-500" : ""}`} />
                  <span className="text-xs font-bold" data-testid={`pc-vote-count-${entry.id}`}>{entry.votes.length}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
