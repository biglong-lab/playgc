// 💬 QuickQuestion — 多人即時問答元件（純 UI）
// 所有人回答同一個問題，答案即時展示在共同牆上
// 適用：暖場破冰、句子接龍、感恩時刻、開放問答

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send } from "lucide-react";

export interface QuickQuestionConfig {
  title?: string;
  question: string;
  maxLength?: number;
  anonymous?: boolean;
  emoji?: string;
}

export interface QuickQuestionResponse {
  id: string;
  text: string;
  submittedAt: number;
  userId: string;
  userName?: string;
}

export interface QuickQuestionState {
  responses: QuickQuestionResponse[];
}

interface QuickQuestionProps {
  config: QuickQuestionConfig;
  state: QuickQuestionState;
  myUserId: string;
  myUserName: string;
  onSubmit: (text: string) => Promise<void>;
}

export default function QuickQuestion({ config, state, myUserId, myUserName: _myUserName, onSubmit }: QuickQuestionProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxLen = config.maxLength ?? 40;
  const anonymous = config.anonymous !== false;
  const emoji = config.emoji ?? "💬";

  const myResponse = state.responses.find((r) => r.userId === myUserId);
  const hasSubmitted = !!myResponse;
  const trimmed = text.trim();

  const handleSubmit = async () => {
    if (!trimmed || isSubmitting || hasSubmitted) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="quick-question-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="quick-question-title">
              <MessageSquare className="w-5 h-5 text-primary" />
              {config.title ?? "💬 快問快答"}
            </CardTitle>
            {state.responses.length > 0 && (
              <Badge variant="outline" data-testid="quick-question-count">
                {state.responses.length} 人已回答
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium mt-1" data-testid="quick-question-prompt">
            {config.question}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasSubmitted ? (
            <div className="py-3 text-center space-y-2" data-testid="quick-question-submitted">
              <p className="text-sm text-green-600 font-medium">✅ 你的答案已送出！</p>
              <p className="text-base font-medium bg-muted/50 rounded-lg px-4 py-2 inline-block">
                {emoji} {myResponse.text}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="輸入你的答案…"
                maxLength={maxLen}
                onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                data-testid="quick-question-input"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{trimmed.length}/{maxLen}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={!trimmed || isSubmitting}
                data-testid="quick-question-submit-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                送出
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 答案牆 */}
      {state.responses.length > 0 && (
        <Card data-testid="quick-question-wall">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-3">大家怎麼說</p>
            <div className="flex flex-wrap gap-2">
              {state.responses
                .slice()
                .sort((a, b) => a.submittedAt - b.submittedAt)
                .map((r) => (
                  <div
                    key={r.id}
                    className="bg-muted/60 rounded-full px-3 py-1 text-sm flex items-center gap-1"
                    data-testid={`response-chip-${r.id}`}
                  >
                    <span>{emoji}</span>
                    <span>{r.text}</span>
                    {!anonymous && r.userName && (
                      <span className="text-xs text-muted-foreground ml-1">— {r.userName}</span>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
