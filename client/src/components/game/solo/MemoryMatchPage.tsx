// 🧠 MemoryMatchPage — 配對記憶遊戲（W18 D5）
//
// 設計依據：docs/decisions/0013-w18-component-expansion.md
// pageType: memory_match
//
// 玩法：
//   - 4×4 / 6×6 翻牌配對遊戲
//   - 個人計時 + 計步
//   - 完成 → onComplete + localStorage best score
//   - 適用：等待過場 / 個人挑戰 / 親子互動 / 解謎熱身
//
// 不接 WS（純 client）— 個人挑戰元件、進度不共享

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Sparkles, RotateCcw } from "lucide-react";

const DEFAULT_EMOJIS = [
  "🎁", "🎉", "🌟", "🎈", "🍰", "🎂", "🎵", "🎤",
  "🌈", "🌸", "🍀", "🦋", "🌺", "🍓", "🍇", "🥨",
  "🐶", "🐱", "🐰",
];

export type MemoryMatchSize = "4x4" | "6x6";

export interface MemoryMatchConfig {
  title?: string;
  subtitle?: string;
  /** 棋盤大小（預設 4x4 = 16 張 = 8 對）*/
  size?: MemoryMatchSize;
  /** 自訂 emoji 池（預設用 DEFAULT_EMOJIS）*/
  emojis?: string[];
  /** 開始前先看 N 秒（預設 3）*/
  showFirstNSeconds?: number;
  /** 完成獎勵點數 */
  rewardPoints?: number;
}

export interface MemoryMatchProps {
  config: MemoryMatchConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

interface CardState {
  id: string;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

/**
 * 純函式：生成洗好牌的陣列（每個 emoji 兩張）
 *
 * @param emojis - 要用的 emoji 池（取 size/2 個）
 * @param totalCards - 棋盤總卡片數（必須偶數）
 * @param seed - 可選種子（測試用）
 */
export function shuffleCards(
  emojis: string[],
  totalCards: number,
  seed?: number,
): CardState[] {
  const pairCount = totalCards / 2;
  const used = emojis.slice(0, pairCount);
  if (used.length < pairCount) {
    // 不足 → 重複使用
    while (used.length < pairCount) used.push(used[used.length % used.length]);
  }
  const cards: CardState[] = [];
  used.forEach((emoji, idx) => {
    cards.push({ id: `${idx}-a`, emoji, flipped: false, matched: false });
    cards.push({ id: `${idx}-b`, emoji, flipped: false, matched: false });
  });
  // Fisher-Yates 洗牌
  let random = seed ?? Date.now();
  const rand = () => {
    random = (random * 9301 + 49297) % 233280;
    return random / 233280;
  };
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/**
 * 純函式：判斷是否全部配對完成
 */
export function isAllMatched(cards: CardState[]): boolean {
  return cards.length > 0 && cards.every((c) => c.matched);
}

/**
 * 純函式：依棋盤大小取總卡片數
 */
export function getTotalCards(size: MemoryMatchSize): number {
  return size === "6x6" ? 36 : 16;
}

export default function MemoryMatchPage({ config, onComplete, sessionId }: MemoryMatchProps) {
  const size = config.size ?? "4x4";
  const showFirstNSeconds = config.showFirstNSeconds ?? 3;
  const emojis = config.emojis ?? DEFAULT_EMOJIS;
  const totalCards = getTotalCards(size);
  const cols = size === "6x6" ? 6 : 4;

  const [cards, setCards] = useState<CardState[]>(() => shuffleCards(emojis, totalCards));
  const [flipping, setFlipping] = useState(false);
  const [steps, setSteps] = useState(0);
  const [previewMode, setPreviewMode] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const isComplete = useMemo(() => isAllMatched(cards), [cards]);

  // 開場 preview：先翻開 N 秒給玩家記
  useEffect(() => {
    if (!previewMode) return;
    setCards((prev) => prev.map((c) => ({ ...c, flipped: true })));
    const timer = setTimeout(() => {
      setCards((prev) => prev.map((c) => ({ ...c, flipped: false })));
      setPreviewMode(false);
      setStartedAt(Date.now());
    }, showFirstNSeconds * 1000);
    return () => clearTimeout(timer);
  }, [previewMode, showFirstNSeconds]);

  // 偵測完成
  useEffect(() => {
    if (isComplete && !finishedAt && startedAt) {
      setFinishedAt(Date.now());
      // 紀錄最佳成績到 localStorage
      const elapsed = Date.now() - startedAt;
      try {
        const key = `memory-match-best:${size}`;
        const prev = localStorage.getItem(key);
        const prevBest = prev ? JSON.parse(prev) : null;
        if (!prevBest || elapsed < prevBest.elapsed) {
          localStorage.setItem(key, JSON.stringify({ elapsed, steps, ts: Date.now() }));
        }
      } catch {
        // ignore
      }
    }
  }, [isComplete, finishedAt, startedAt, steps, size]);

  const handleFlip = useCallback(
    (idx: number) => {
      if (previewMode || flipping) return;
      const card = cards[idx];
      if (card.matched || card.flipped) return;

      const flippedCount = cards.filter((c) => c.flipped && !c.matched).length;
      if (flippedCount >= 2) return;

      const newCards = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
      setCards(newCards);

      // 檢查是否兩張都翻開
      const flipped = newCards.filter((c) => c.flipped && !c.matched);
      if (flipped.length === 2) {
        setSteps((s) => s + 1);
        setFlipping(true);
        if (flipped[0].emoji === flipped[1].emoji) {
          // 配對成功
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) => (c.flipped && !c.matched ? { ...c, matched: true } : c)),
            );
            setFlipping(false);
          }, 500);
        } else {
          // 配對失敗 → 翻回去
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) => (c.flipped && !c.matched ? { ...c, flipped: false } : c)),
            );
            setFlipping(false);
          }, 1000);
        }
      }
    },
    [cards, flipping, previewMode],
  );

  const handleReset = useCallback(() => {
    setCards(shuffleCards(emojis, totalCards));
    setSteps(0);
    setPreviewMode(true);
    setStartedAt(null);
    setFinishedAt(null);
  }, [emojis, totalCards]);

  const elapsed = finishedAt && startedAt ? finishedAt - startedAt : 0;
  const elapsedSec = Math.round(elapsed / 1000);

  // ─── 完成版 ───
  if (isComplete && finishedAt) {
    return (
      <div className="w-full max-w-md mx-auto p-6 space-y-4">
        <Card className="bg-gradient-to-br from-amber-100 to-orange-200 border-amber-400 border-2">
          <CardContent className="p-8 text-center space-y-3">
            <Trophy className="w-20 h-20 mx-auto text-amber-600" />
            <h2 className="text-3xl font-bold text-amber-900">🎉 全部配對！</h2>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-zinc-500">用時</div>
                <div className="text-2xl font-bold text-amber-700">{elapsedSec}s</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-zinc-500">步數</div>
                <div className="text-2xl font-bold text-amber-700">{steps}</div>
              </div>
            </div>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={handleReset} data-testid="btn-memory-replay">
                <RotateCcw className="w-4 h-4 mr-1" />
                再玩一次
              </Button>
              <Button
                onClick={() => onComplete({ points: config.rewardPoints ?? 0 })}
                data-testid="btn-memory-next"
              >
                繼續下一頁
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── 主棋盤 ───
  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">🧠 {config.title ?? "記憶配對"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 計數面板 */}
      <div className="flex justify-center gap-3">
        <Badge variant="secondary" className="text-base">
          <Clock className="w-3 h-3 mr-1" />
          步數 {steps}
        </Badge>
        <Badge variant="secondary" className="text-base">
          <Sparkles className="w-3 h-3 mr-1" />
          {cards.filter((c) => c.matched).length / 2} / {totalCards / 2} 對
        </Badge>
      </div>

      {/* preview 提示 */}
      {previewMode && (
        <div className="text-center text-amber-700 dark:text-amber-300 text-sm bg-amber-100 dark:bg-amber-950 p-2 rounded">
          🔍 記住卡片位置（{showFirstNSeconds} 秒後翻回去）
        </div>
      )}

      {/* 棋盤 */}
      <div
        className={`grid gap-2 max-w-md mx-auto`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        data-testid="memory-board"
      >
        {cards.map((card, idx) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleFlip(idx)}
            disabled={card.matched || flipping || previewMode}
            className={`aspect-square rounded-lg text-3xl md:text-4xl flex items-center justify-center transition-all ${
              card.matched
                ? "bg-emerald-200 ring-2 ring-emerald-400"
                : card.flipped
                ? "bg-amber-100 ring-2 ring-amber-400"
                : "bg-purple-500 hover:bg-purple-600 active:scale-95 cursor-pointer"
            }`}
            data-testid={`memory-card-${idx}`}
          >
            {card.flipped || card.matched ? card.emoji : "?"}
          </button>
        ))}
      </div>
    </div>
  );
}
