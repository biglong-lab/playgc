// 📖 StoryChain — 接龍故事，L3 持久化
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Feather } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StoryEntry {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  addedAt: number;
}

export interface StoryChainConfig {
  title: string;
  opening: string;
  maxWordsPerContribution: number;
  maxContributions: number;
  finishText?: string;
}

export interface StoryChainState extends Record<string, unknown> {
  entries: StoryEntry[];
  finished: boolean;
}

interface StoryChainProps {
  config: StoryChainConfig;
  state: StoryChainState;
  myUserId: string;
  onAdd: (text: string) => Promise<void>;
  onFinish: () => Promise<void>;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function StoryChain({ config, state, myUserId, onAdd, onFinish }: StoryChainProps) {
  const { entries, finished } = state;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasAdded = entries.some((e) => e.authorId === myUserId);
  const isFull = entries.length >= config.maxContributions;
  const wordCount = countWords(text);
  const overLimit = wordCount > config.maxWordsPerContribution;
  const canAdd = text.trim().length > 0 && !overLimit && !hasAdded && !isFull && !finished;

  const handleAdd = async () => {
    if (!canAdd || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const fullStory = [config.opening, ...entries.map((e) => e.text)].join("　");

  if (finished) {
    return (
      <Card data-testid="story-finished">
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <BookOpen className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold">📖 故事完成！</h2>
          </div>
          <div
            data-testid="full-story"
            className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-base leading-relaxed"
          >
            {fullStory}
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {config.finishText ?? "感謝所有創作者！"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="story-chain-root">
      <CardContent className="p-6 space-y-5">
        {/* 標題 */}
        <div className="flex items-center gap-2">
          <Feather className="w-5 h-5 text-amber-500" />
          <h2 data-testid="story-title" className="text-xl font-bold">{config.title}</h2>
        </div>

        {/* 進度 */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="story-progress">
            {entries.length} / {config.maxContributions} 人接龍
          </Badge>
          {isFull && (
            <Badge className="bg-green-100 text-green-700">故事完整了！</Badge>
          )}
        </div>

        {/* 目前故事全文 */}
        <div
          data-testid="story-content"
          className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-base leading-relaxed min-h-24"
        >
          <span className="font-semibold text-amber-800 dark:text-amber-200">{config.opening}</span>
          {entries.map((e, idx) => (
            <span key={e.id}>
              <span className="mx-1 text-muted-foreground">…</span>
              <span
                data-testid={`entry-${idx}`}
                className={cn(
                  "transition-colors",
                  e.authorId === myUserId ? "text-blue-700 dark:text-blue-300 font-medium" : ""
                )}
              >
                {e.text}
              </span>
            </span>
          ))}
          {!hasAdded && !isFull && (
            <span className="ml-1 text-muted-foreground animate-pulse">▌</span>
          )}
        </div>

        {/* 作者列表 */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entries.map((e) => (
              <Badge
                key={e.id}
                data-testid={`author-badge-${e.authorId}`}
                variant="secondary"
                className="text-xs"
              >
                {e.authorName}
              </Badge>
            ))}
          </div>
        )}

        {/* 輸入區 */}
        {!hasAdded && !isFull ? (
          <div className="space-y-2">
            <Textarea
              data-testid="story-input"
              placeholder={`接續故事（最多 ${config.maxWordsPerContribution} 個字）…`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className={cn("text-xs", overLimit ? "text-red-500 font-medium" : "text-muted-foreground")}>
                {wordCount} / {config.maxWordsPerContribution} 字{overLimit ? "（超出限制）" : ""}
              </span>
              <Button
                data-testid="add-story-btn"
                size="sm"
                onClick={handleAdd}
                disabled={!canAdd || submitting}
              >
                加入接龍 ✍️
              </Button>
            </div>
          </div>
        ) : hasAdded ? (
          <div data-testid="already-added" className="text-center text-green-600 font-medium py-2">
            ✅ 你已接龍！等待其他人繼續…
          </div>
        ) : null}

        {/* 完成按鈕（任何人都可以結束） */}
        {isFull && (
          <Button
            data-testid="finish-story-btn"
            onClick={onFinish}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            📖 完成故事！
          </Button>
        )}
        {!isFull && entries.length >= Math.ceil(config.maxContributions / 2) && (
          <Button
            data-testid="finish-early-btn"
            variant="outline"
            size="sm"
            onClick={onFinish}
            className="w-full text-muted-foreground"
          >
            提早結束故事
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
