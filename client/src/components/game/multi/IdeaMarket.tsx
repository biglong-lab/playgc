import { useState } from "react";
import { Lightbulb, ShoppingCart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface IdeaEntry extends Record<string, unknown> {
  ideaId: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  votes: number;
  voters: string[];
}

export interface IdeaMarketConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  voteLabel: string;
  votesPerPlayer: number;
  maxLength: number;
  submissionLabel: string;
}

export interface IdeaMarketState extends Record<string, unknown> {
  ideas: IdeaEntry[];
  revealed: boolean;
}

interface Props {
  config: IdeaMarketConfig;
  state: IdeaMarketState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (title: string, description: string) => void;
  onVote: (ideaId: string) => void;
  onReveal: () => void;
}

// ── 元件 ──────────────────────────────────────────────
export function IdeaMarket({
  config,
  state,
  userId,
  isTeamLead,
  onSubmit,
  onVote,
  onReveal,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const myEntry = state.ideas.find((i) => i.userId === userId);
  const hasSubmitted = !!myEntry;

  const usedVotes = state.ideas.reduce(
    (sum, i) => sum + (i.voters.includes(userId) ? 1 : 0),
    0,
  );
  const remainingVotes = config.votesPerPlayer - usedVotes;

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit(title.trim(), description.trim());
    setTitle("");
    setDescription("");
  }

  const sorted = [...state.ideas].sort((a, b) => b.votes - a.votes);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg" data-testid="im-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="im-prompt">
        {config.prompt}
      </p>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" data-testid="im-votes-left">
          <ShoppingCart className="h-3 w-3 mr-1" />
          剩餘票數：{remainingVotes}/{config.votesPerPlayer}
        </Badge>
        <Badge variant="outline" data-testid="im-count">
          {state.ideas.length} 個點子
        </Badge>
      </div>

      {!hasSubmitted && (
        <div className="space-y-2 border rounded-lg p-4">
          <p className="text-sm font-medium">{config.submissionLabel}</p>
          <Input
            placeholder="點子標題（必填）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={config.maxLength}
            data-testid="im-title-input"
          />
          <Textarea
            placeholder="詳細說明（選填）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={config.maxLength * 2}
            rows={2}
            data-testid="im-desc-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full"
            data-testid="im-submit-btn"
          >
            提交點子
          </Button>
        </div>
      )}

      {hasSubmitted && (
        <div
          className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20"
          data-testid="im-my-idea"
        >
          <p className="text-xs text-muted-foreground mb-1">我的點子</p>
          <p className="font-medium">{myEntry!.title}</p>
          {myEntry!.description && (
            <p className="text-sm text-muted-foreground">{myEntry!.description}</p>
          )}
        </div>
      )}

      {!state.revealed && state.ideas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="im-empty">
          還沒有人提交點子
        </p>
      )}

      {!state.revealed && state.ideas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">為你喜歡的點子投票</p>
          {state.ideas.map((idea) => {
            const voted = idea.voters.includes(userId);
            const isOwn = idea.userId === userId;
            return (
              <div
                key={idea.ideaId}
                className="border rounded-lg p-3 flex items-start gap-3"
                data-testid={`im-idea-${idea.ideaId}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{idea.title}</p>
                  {idea.description && (
                    <p className="text-xs text-muted-foreground">{idea.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{idea.userName}</p>
                </div>
                <Button
                  size="sm"
                  variant={voted ? "default" : "outline"}
                  onClick={() => onVote(idea.ideaId)}
                  disabled={isOwn || (remainingVotes <= 0 && !voted)}
                  data-testid={`im-vote-${idea.ideaId}`}
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {idea.votes}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {state.revealed && (
        <div className="space-y-2" data-testid="im-result">
          <p className="text-sm font-semibold flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-yellow-500" />
            點子排行榜
          </p>
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="im-empty">
              沒有提交的點子
            </p>
          )}
          {sorted.map((idea, idx) => (
            <div
              key={idea.ideaId}
              className="border rounded-lg p-3"
              data-testid={`im-ranked-${idea.ideaId}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg text-muted-foreground mr-2">
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{idea.title}</p>
                  {idea.description && (
                    <p className="text-xs text-muted-foreground">{idea.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{idea.userName}</p>
                </div>
                <Badge className="ml-2">{idea.votes} 票</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && state.ideas.length > 0 && (
        <Button
          onClick={onReveal}
          className="w-full"
          data-testid="im-reveal-btn"
        >
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default IdeaMarket;
