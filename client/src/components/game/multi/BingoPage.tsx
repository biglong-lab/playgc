// 🎱 BingoPage — pageType="bingo" 容器（L3 持久化版 2026-05-05）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Bingo, { type BingoConfig } from "./Bingo";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface BingoPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface BingoState extends Record<string, unknown> {
  markedItems: string[];
  isWon: boolean;
}

export default function BingoPage({ page, sessionId, gameId, pageId, onComplete }: BingoPageProps) {
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: BingoConfig } | BingoConfig | null) ?? null;
  const config: BingoConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as BingoConfig | null)) ?? {
      title: "🎱 賓果對決",
      subtitle: "點格子，連成一線就 BINGO！",
      items: [
        "去過日本", "有養寵物", "是長子女", "喜歡咖啡", "會騎機車",
        "喜歡唱歌", "有學過樂器", "最近看過電影", "喜歡健行", "會游泳",
        "有出國旅遊", "喜歡下廚", "是夜貓子", "有運動習慣", "喜歡閱讀",
      ],
      gridSize: 4,
      winCondition: "line",
    };

  const defaultState: BingoState = { markedItems: [], isWon: false };

  const { state, updateState, isLoaded } = useTeamPagePersistence<BingoState>({
    gameId, sessionId, pageId, type: "bingo", defaultState,
  });

  const handleMark = useCallback(async (item: string) => {
    if (state.markedItems.includes(item)) return;
    const newMarked = [...state.markedItems, item];
    const gridSize = config.gridSize ?? 3;
    const items = config.items.slice(0, gridSize * gridSize);
    const condition = config.winCondition ?? "line";

    let isWon = false;
    if (condition === "full") {
      isWon = items.every((it) => newMarked.includes(it));
    } else {
      const size = gridSize;
      const grid = items;
      const markedSet = new Set(newMarked);
      for (let r = 0; r < size && !isWon; r++) {
        if (grid.slice(r * size, r * size + size).every((it) => markedSet.has(it))) isWon = true;
      }
      for (let c = 0; c < size && !isWon; c++) {
        let ok = true;
        for (let r = 0; r < size; r++) {
          if (!markedSet.has(grid[r * size + c])) { ok = false; break; }
        }
        if (ok) isWon = true;
      }
      const d1 = Array.from({ length: size }, (_, i) => grid[i * size + i]);
      const d2 = Array.from({ length: size }, (_, i) => grid[i * size + (size - 1 - i)]);
      if (d1.every((it) => markedSet.has(it))) isWon = true;
      if (d2.every((it) => markedSet.has(it))) isWon = true;
    }

    await updateState({ markedItems: newMarked, isWon });
    if (isWon && onComplete) onComplete();
  }, [state.markedItems, config, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card data-testid="bingo-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Bingo
      config={config}
      state={state}
      myUserName={myUserName}
      onMark={handleMark}
    />
  );
}
