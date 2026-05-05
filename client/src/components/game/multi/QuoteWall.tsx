import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface QuoteEntry extends Record<string, unknown> {
  quoteId: string;
  userId: string;
  userName: string;
  text: string;
  author: string;
}

export interface QuoteWallConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  placeholder: string;
}

export interface QuoteWallState extends Record<string, unknown> {
  quotes: QuoteEntry[];
  revealed: boolean;
}

interface QuoteWallProps {
  config: QuoteWallConfig;
  state: QuoteWallState;
  myUserId: string;
  onSubmit: (text: string, author: string) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: QuoteWallConfig = {
  title: "名言牆",
  prompt: "分享你最喜歡的一句話",
  maxLength: 100,
  placeholder: "例如：凡走過，必留下痕跡",
};

function extractConfig(raw: unknown): QuoteWallConfig {
  const r = raw as Record<string, unknown>;
  if (r && "placeholder" in r) return r as unknown as QuoteWallConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("placeholder" in c) return c as unknown as QuoteWallConfig;
  }
  return DEFAULT_CONFIG;
}

export default function QuoteWall({ config: rawConfig, state, myUserId, onSubmit, onReveal }: QuoteWallProps) {
  const config = extractConfig(rawConfig as unknown);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");

  const myQuote = state.quotes.find((q) => q.userId === myUserId);

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim(), author.trim());
    setText("");
    setAuthor("");
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="qw-result">
        <h2 className="text-xl font-bold" data-testid="qw-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="qw-count">共 {state.quotes.length} 則名言</p>
        {state.quotes.length === 0 ? (
          <p className="text-muted-foreground" data-testid="qw-empty">還沒有人分享名言</p>
        ) : (
          <div className="grid gap-3">
            {state.quotes.map((q) => (
              <div key={q.quoteId} className="p-4 border rounded-lg bg-muted/30" data-testid={`qw-quote-${q.quoteId}`}>
                <p className="text-base italic">「{q.text}」</p>
                {q.author && <p className="text-sm text-muted-foreground mt-1">—— {q.author}</p>}
                <p className="text-xs text-muted-foreground mt-1">by {q.userName}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="qw-title">{config.title}</h2>
      <p className="text-sm" data-testid="qw-prompt">{config.prompt}</p>
      <p className="text-sm text-muted-foreground" data-testid="qw-count">已分享：{state.quotes.length} 人</p>

      {myQuote ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="qw-my-quote">
          <p className="italic">「{myQuote.text}」</p>
          {myQuote.author && <p className="text-sm text-muted-foreground">—— {myQuote.author}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder={config.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={config.maxLength}
            rows={3}
            data-testid="qw-text-input"
          />
          <Input
            placeholder="名言出處（可選）"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={40}
            data-testid="qw-author-input"
          />
          <Button disabled={!text.trim()} onClick={handleSubmit} data-testid="qw-submit-btn">
            分享名言
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="qw-reveal-btn">
        公布所有名言
      </Button>
    </div>
  );
}
