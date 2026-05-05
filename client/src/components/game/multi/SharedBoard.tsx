// 📋 SharedBoard — 共識牆（純 UI 元件）
// 玩家各自張貼卡片，所有人即時看到彼此的回應
// 適用：破冰、腦力激盪、Workshop 討論、回顧

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

export interface BoardCard {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  color: string;
  createdAt: number;
}

export interface SharedBoardConfig {
  title?: string;
  prompt?: string;
  maxCardsPerPerson?: number;
  cardColors?: string[];
  allowDelete?: boolean;
}

export interface SharedBoardState {
  cards: BoardCard[];
}

interface SharedBoardProps {
  config: SharedBoardConfig;
  state: SharedBoardState;
  myUserId: string;
  myUserName: string;
  onAddCard: (text: string, color: string) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
}

const DEFAULT_COLORS = [
  "#fef08a", // 黃
  "#bbf7d0", // 綠
  "#bfdbfe", // 藍
  "#fecaca", // 紅
  "#e9d5ff", // 紫
  "#fed7aa", // 橙
];

export default function SharedBoard({
  config,
  state,
  myUserId,
  myUserName,
  onAddCard,
  onDeleteCard,
}: SharedBoardProps) {
  const [inputText, setInputText] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colors = config.cardColors ?? DEFAULT_COLORS;
  const maxCards = config.maxCardsPerPerson ?? 3;
  const myCardCount = state.cards.filter((c) => c.authorId === myUserId).length;
  const canAdd = myCardCount < maxCards && inputText.trim().length > 0;

  const handleAdd = async () => {
    if (!canAdd || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddCard(inputText.trim(), selectedColor);
      setInputText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleAdd();
    }
  };

  return (
    <div className="space-y-4">
      {/* 標題與說明 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{config.title ?? "📋 共識牆"}</CardTitle>
          {config.prompt && (
            <p className="text-sm text-muted-foreground">{config.prompt}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 輸入區 */}
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入你的想法... (Ctrl+Enter 送出)"
            className="min-h-[80px] resize-none"
            maxLength={200}
            disabled={myCardCount >= maxCards}
          />
          <div className="flex items-center gap-3">
            {/* 顏色選擇 */}
            <div className="flex gap-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: c,
                    borderColor: selectedColor === c ? "#374151" : "transparent",
                    transform: selectedColor === c ? "scale(1.2)" : "scale(1)",
                  }}
                  aria-label={`選擇顏色 ${c}`}
                />
              ))}
            </div>
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs">
              {myCardCount}/{maxCards} 張
            </Badge>
            <Button
              size="sm"
              onClick={() => void handleAdd()}
              disabled={!canAdd || isSubmitting}
            >
              <Plus className="w-4 h-4 mr-1" />
              張貼
            </Button>
          </div>
          {myCardCount >= maxCards && (
            <p className="text-xs text-amber-600">已達上限（{maxCards} 張）</p>
          )}
        </CardContent>
      </Card>

      {/* 卡片牆 */}
      {state.cards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            還沒有人張貼，快成為第一個！
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[...state.cards]
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((card) => (
              <div
                key={card.id}
                className="relative rounded-lg p-3 shadow-sm min-h-[80px] flex flex-col gap-1"
                style={{ backgroundColor: card.color }}
              >
                <p className="text-xs font-medium text-gray-600">{card.authorName}</p>
                <p className="text-sm text-gray-800 flex-1 whitespace-pre-wrap break-words">
                  {card.text}
                </p>
                {(config.allowDelete !== false) && card.authorId === myUserId && (
                  <button
                    onClick={() => void onDeleteCard(card.id)}
                    className="absolute top-1 right-1 p-1 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                    aria-label="刪除卡片"
                  >
                    <Trash2 className="w-3 h-3 text-gray-600" />
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
