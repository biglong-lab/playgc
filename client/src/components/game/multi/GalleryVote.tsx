import { useState } from "react";
import { Image, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface GallerySub extends Record<string, unknown> {
  subId: string;
  userId: string;
  userName: string;
  content: string;
}

export interface GalleryVoteEntry extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  targetId: string;
}

export interface GalleryVoteConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  galleryLabel: string;
  placeholder: string;
  maxLength: number;
}

export interface GalleryVoteState extends Record<string, unknown> {
  submissions: GallerySub[];
  votes: GalleryVoteEntry[];
  revealed: boolean;
}

interface Props {
  config: GalleryVoteConfig;
  state: GalleryVoteState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (content: string) => void;
  onVote: (targetId: string) => void;
  onReveal: () => void;
}

function tallyVotes(votes: GalleryVoteEntry[]): Record<string, number> {
  return votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.targetId] = (acc[v.targetId] ?? 0) + 1;
    return acc;
  }, {});
}

// ── 元件 ──────────────────────────────────────────────
export function GalleryVote({ config, state, userId, isTeamLead, onSubmit, onVote, onReveal }: Props) {
  const [text, setText] = useState("");

  const mySub = state.submissions.find((s) => s.userId === userId);
  const myVote = state.votes.find((v) => v.userId === userId);
  const hasSubmitted = !!mySub;
  const hasVoted = !!myVote;
  const tally = state.revealed ? tallyVotes(state.votes) : {};
  const sorted = [...state.submissions].sort(
    (a, b) => (tally[b.subId] ?? 0) - (tally[a.subId] ?? 0),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Image className="h-5 w-5 text-indigo-500" />
        <h3 className="font-bold text-lg" data-testid="gv-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="gv-prompt">
        {config.prompt}
      </p>

      <div className="flex items-center gap-2">
        <Badge variant="outline" data-testid="gv-sub-count">
          {state.submissions.length} 件作品
        </Badge>
        <Badge variant="outline" data-testid="gv-vote-count">
          {state.votes.length} 票
        </Badge>
      </div>

      {!hasSubmitted && (
        <div className="space-y-2 border rounded-lg p-4">
          <label className="text-sm font-medium">{config.galleryLabel}</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={config.placeholder}
            maxLength={config.maxLength}
            rows={3}
            data-testid="gv-input"
            className="w-full border rounded px-3 py-2 text-sm resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {text.length}/{config.maxLength}
            </span>
            <Button
              onClick={() => onSubmit(text.trim())}
              disabled={text.trim().length === 0}
              data-testid="gv-submit-btn"
            >
              提交作品
            </Button>
          </div>
        </div>
      )}

      {hasSubmitted && !state.revealed && (
        <div
          className="border rounded-lg p-3 bg-indigo-50 dark:bg-indigo-900/20"
          data-testid="gv-my-sub"
        >
          <p className="text-xs text-muted-foreground mb-1">我的作品</p>
          <p className="text-sm font-medium">{mySub!.content}</p>
          <p className="text-xs text-muted-foreground mt-1">等待揭曉...</p>
        </div>
      )}

      {!state.revealed && state.submissions.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="gv-empty"
        >
          還沒有人提交作品
        </p>
      )}

      {hasSubmitted && !state.revealed && state.submissions.length > 1 && !hasVoted && (
        <div className="space-y-2">
          <p className="text-sm font-medium">為你最喜歡的作品投票：</p>
          {state.submissions
            .filter((s) => s.userId !== userId)
            .map((s) => (
              <div
                key={s.subId}
                className="flex items-start gap-2 border rounded-lg p-3"
                data-testid={`gv-sub-${s.subId}`}
              >
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{s.userName}</p>
                  <p className="text-sm">{s.content}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onVote(s.subId)}
                  data-testid={`gv-vote-btn-${s.subId}`}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
              </div>
            ))}
        </div>
      )}

      {hasVoted && !state.revealed && (
        <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20" data-testid="gv-voted">
          <p className="text-sm font-medium">已投票！等待結果揭曉...</p>
        </div>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="gv-result">
          {state.submissions.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-testid="gv-empty"
            >
              沒有作品資料
            </p>
          )}
          {sorted.map((s, rank) => (
            <div
              key={s.subId}
              className={`border rounded-lg p-3 ${rank === 0 && (tally[s.subId] ?? 0) > 0 ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20" : ""}`}
              data-testid={`gv-result-${s.subId}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{s.userName}</span>
                <Badge variant={rank === 0 && (tally[s.subId] ?? 0) > 0 ? "default" : "secondary"}>
                  {tally[s.subId] ?? 0} 票
                </Badge>
              </div>
              <p className="text-sm font-medium">{s.content}</p>
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && state.submissions.length > 0 && (
        <Button onClick={onReveal} className="w-full" data-testid="gv-reveal-btn">
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default GalleryVote;
