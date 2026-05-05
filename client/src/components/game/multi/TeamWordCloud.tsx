// 🌐 TeamWordCloud — 多人詞雲元件（純 UI）
// 每人貢獻 1-3 個詞，即時顯示詞雲（字型大小依頻率）
// 適用：回顧一個詞、腦力激盪、破冰開場

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Cloud, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeamWordCloudConfig {
  title?: string;
  question?: string;
  maxWordsPerPerson?: number;
  maxWordLength?: number;
}

export interface WordEntry {
  userId: string;
  userName: string;
  words: string[];
  submittedAt: number;
}

export interface TeamWordCloudState {
  entries: WordEntry[];
}

interface TeamWordCloudProps {
  config: TeamWordCloudConfig;
  state: TeamWordCloudState;
  myUserId: string;
  myUserName: string;
  onSubmit: (words: string[]) => Promise<void>;
}

function buildWordFrequency(entries: WordEntry[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const e of entries) {
    for (const w of e.words) {
      const key = w.trim().toLowerCase();
      if (key) freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  return freq;
}

function WordCloudDisplay({ entries }: { entries: WordEntry[] }) {
  const freq = buildWordFrequency(entries);
  if (freq.size === 0) return null;

  const maxFreq = Math.max(...Array.from(freq.values()));
  const words = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);

  const COLOR_PALETTE = [
    "text-blue-600", "text-purple-600", "text-pink-500",
    "text-emerald-600", "text-orange-500", "text-indigo-600",
    "text-rose-500", "text-teal-600",
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center p-2" data-testid="word-cloud-display">
      {words.map(([word, count], i) => {
        const ratio = count / maxFreq;
        const sizeClass =
          ratio > 0.75 ? "text-2xl font-bold" :
          ratio > 0.5  ? "text-xl font-semibold" :
          ratio > 0.25 ? "text-lg font-medium" :
          "text-base";
        const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
        return (
          <span
            key={word}
            data-testid={`cloud-word-${word}`}
            className={cn("transition-all duration-300", sizeClass, color)}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export default function TeamWordCloud({ config, state, myUserId, myUserName: _myUserName, onSubmit }: TeamWordCloudProps) {
  const maxWords = config.maxWordsPerPerson ?? 3;
  const maxLen = config.maxWordLength ?? 15;

  const [inputs, setInputs] = useState<string[]>(Array(maxWords).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myEntry = state.entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;

  const totalPeople = state.entries.length;
  const validWords = inputs.map((w) => w.trim()).filter((w) => w.length > 0 && w.length <= maxLen);

  const handleSubmit = async () => {
    if (validWords.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(validWords);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateInput = (idx: number, val: string) => {
    setInputs((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  return (
    <div className="space-y-4" data-testid="team-word-cloud-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="word-cloud-title">
              <Cloud className="w-5 h-5 text-primary" />
              {config.title ?? "🌐 團隊詞雲"}
            </CardTitle>
            {totalPeople > 0 && (
              <Badge variant="outline" data-testid="word-cloud-count">
                {totalPeople} 人已貢獻
              </Badge>
            )}
          </div>
          {config.question && (
            <p className="text-sm text-muted-foreground" data-testid="word-cloud-question">
              {config.question}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSubmitted ? (
            <div className="text-center py-4 space-y-2" data-testid="word-cloud-submitted">
              <p className="text-sm text-green-600 font-medium">✅ 你的詞已提交！</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {myEntry.words.map((w) => (
                  <Badge key={w} variant="secondary">{w}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                輸入最多 {maxWords} 個詞（每個詞最多 {maxLen} 字）
              </p>
              <div className="space-y-2">
                {Array.from({ length: maxWords }).map((_, i) => (
                  <Input
                    key={i}
                    value={inputs[i]}
                    onChange={(e) => updateInput(i, e.target.value)}
                    placeholder={`第 ${i + 1} 個詞（選填）`}
                    maxLength={maxLen}
                    data-testid={`word-input-${i + 1}`}
                  />
                ))}
              </div>
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={validWords.length === 0 || isSubmitting}
                data-testid="word-cloud-submit-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                送出詞彙
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {state.entries.length > 0 && (
        <Card data-testid="word-cloud-stats">
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              共 {state.entries.reduce((s, e) => s + e.words.length, 0)} 個詞
            </p>
            <WordCloudDisplay entries={state.entries} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
