// 🎲 SeatDrawPage — pageType="seat_draw" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SeatDraw, { type SeatDrawConfig, type SeatDrawState, type DrawResult } from "./SeatDraw";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface SeatDrawPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function SeatDrawPage({ page, sessionId, gameId, pageId, onComplete }: SeatDrawPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: SeatDrawConfig } | SeatDrawConfig | null) ?? null;
  const config: SeatDrawConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as SeatDrawConfig | null)) ?? {
      title: "🎲 抽籤分組",
      slots: [
        { id: "g1", label: "A 組", emoji: "🔵" },
        { id: "g2", label: "B 組", emoji: "🔴" },
        { id: "g3", label: "C 組", emoji: "🟢" },
        { id: "g4", label: "D 組", emoji: "🟡" },
      ],
    };

  const initialPool = config.slots.map((s) => s.id);
  const defaultState: SeatDrawState = { results: [], pool: initialPool };

  const { state, updateState, isLoaded } = useTeamPagePersistence<SeatDrawState>({
    gameId, sessionId, pageId, type: "seat_draw", defaultState,
  });

  const handleDraw = useCallback(async () => {
    if (state.results.find((r: DrawResult) => r.userId === myUserId)) return;

    const pool: string[] = Array.isArray(state.pool) && state.pool.length > 0
      ? [...state.pool]
      : config.slots.map((s) => s.id);

    if (pool.length === 0) return;

    const idx = Math.floor(Math.random() * pool.length);
    const slotId = pool[idx];
    const remaining = pool.filter((_, i) => i !== idx);

    const newResult: DrawResult = {
      userId: myUserId,
      userName: myUserName,
      slotId,
      drawnAt: Date.now(),
    };

    await updateState({
      results: [...state.results, newResult],
      pool: remaining,
    });
    if (onComplete) onComplete();
  }, [state, myUserId, myUserName, config.slots, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <SeatDraw
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onDraw={handleDraw}
    />
  );
}
