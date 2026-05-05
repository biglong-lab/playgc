import { useState } from "react";
import { ThumbsUp, Trophy, Send, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PhotoCaptionConfig {
  title: string;
  photoUrl: string;
  prompt?: string;
  maxCaptionLength: number;
  maxCaptionsPerPerson: number;
  showVotes: boolean;
}

export interface Caption {
  id: string;
  text: string;
  submitterId: string;
  submitterName: string;
  votes: string[];
  submittedAt: number;
}

export interface PhotoCaptionState extends Record<string, unknown> {
  captions: Caption[];
}

interface Props {
  config: PhotoCaptionConfig;
  state: PhotoCaptionState;
  myUserId: string;
  draftCaption: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onVote: (captionId: string) => void;
}

export default function PhotoCaption({
  config,
  state,
  myUserId,
  draftCaption,
  onDraftChange,
  onSubmit,
  onVote,
}: Props) {
  const { title, photoUrl, prompt, maxCaptionLength, maxCaptionsPerPerson, showVotes } = config;
  const { captions } = state;

  const mySubmissions = captions.filter((c) => c.submitterId === myUserId);
  const hasReachedLimit = mySubmissions.length >= maxCaptionsPerPerson;
  const canSubmit = draftCaption.trim().length > 0 && !hasReachedLimit;

  const sorted = showVotes
    ? [...captions].sort((a, b) => b.votes.length - a.votes.length)
    : captions;

  const topCaption = sorted[0];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-fuchsia-50 to-pink-50 flex flex-col px-4 py-6 gap-5"
      data-testid="pc-root"
    >
      <div className="text-center">
        <div className="text-3xl mb-1">📸</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="pc-title">{title}</h1>
        {prompt && (
          <p className="text-gray-500 text-sm mt-1" data-testid="pc-prompt">{prompt}</p>
        )}
      </div>

      {photoUrl ? (
        <div
          className="rounded-2xl overflow-hidden shadow-lg bg-gray-100"
          data-testid="pc-photo-container"
        >
          <img
            src={photoUrl}
            alt="配文照片"
            className="w-full object-cover max-h-64"
            data-testid="pc-photo"
          />
        </div>
      ) : (
        <div
          className="rounded-2xl bg-gray-100 flex items-center justify-center h-40 text-gray-400"
          data-testid="pc-photo-placeholder"
        >
          <Image className="w-10 h-10" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4" data-testid="pc-input-area">
        <textarea
          value={draftCaption}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="輸入你的最佳配文..."
          maxLength={maxCaptionLength}
          rows={2}
          disabled={hasReachedLimit}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-fuchsia-400 disabled:bg-gray-50 disabled:text-gray-400"
          data-testid="pc-input"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400" data-testid="pc-char-count">
            {draftCaption.length} / {maxCaptionLength}
          </span>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
            data-testid="pc-submit-btn"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            提交
          </Button>
        </div>
        {hasReachedLimit && (
          <p className="text-xs text-gray-400 mt-1" data-testid="pc-limit-msg">
            已達最大提交數（{maxCaptionsPerPerson} 則）
          </p>
        )}
      </div>

      <div
        className="bg-white rounded-xl p-3 text-center text-sm text-gray-500"
        data-testid="pc-count"
      >
        共 <span className="font-semibold text-fuchsia-600">{captions.length}</span> 則配文
      </div>

      {captions.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="pc-list">
          {sorted.map((caption, idx) => {
            const isTop = idx === 0 && caption.votes.length > 0;
            const hasVoted = caption.votes.includes(myUserId);
            const isOwn = caption.submitterId === myUserId;
            return (
              <div
                key={caption.id}
                className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all ${
                  isTop ? "border-yellow-400" : "border-transparent"
                }`}
                data-testid={`pc-caption-${caption.id}`}
              >
                {isTop && (
                  <div className="flex items-center gap-1 text-xs font-medium text-yellow-600 mb-2" data-testid={`pc-top-${caption.id}`}>
                    <Trophy className="w-3.5 h-3.5" />
                    最高人氣
                  </div>
                )}
                <p className="text-gray-800 font-medium mb-2" data-testid={`pc-text-${caption.id}`}>
                  「{caption.text}」
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400" data-testid={`pc-by-${caption.id}`}>
                    — {caption.submitterName}
                  </span>
                  {showVotes && (
                    <button
                      onClick={() => onVote(caption.id)}
                      disabled={isOwn}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all ${
                        hasVoted
                          ? "bg-fuchsia-100 text-fuchsia-700 font-semibold"
                          : "bg-gray-100 text-gray-500 hover:bg-fuchsia-50"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      data-testid={`pc-vote-${caption.id}`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span data-testid={`pc-vote-count-${caption.id}`}>{caption.votes.length}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {captions.length === 0 && (
        <p className="text-center text-sm text-gray-400" data-testid="pc-empty">
          還沒有配文，搶先提交！
        </p>
      )}
    </div>
  );
}
