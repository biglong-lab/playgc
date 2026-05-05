// 🧩 JigsawPuzzlePage — pageType="jigsaw_puzzle" 容器（L3 持久化版 2026-05-05）

import { useCallback, useMemo } from "react";
import JigsawPuzzle, { type JigsawPuzzleConfig } from "./JigsawPuzzle";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface JigsawPuzzlePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface JigsawSlot extends Record<string, unknown> {
  id: string;
  row: number;
  col: number;
  prompt: string;
  filledBy?: string;
  text?: string;
  color?: string;
}

interface JigsawState extends Record<string, unknown> {
  slots: JigsawSlot[];
  isComplete: boolean;
}

export default function JigsawPuzzlePage({ page, sessionId, gameId, pageId }: JigsawPuzzlePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: JigsawPuzzleConfig } | JigsawPuzzleConfig | null) ?? null;
  const config: JigsawPuzzleConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as JigsawPuzzleConfig | null)) ?? {};
  const rows = config.rows ?? 2;
  const cols = config.cols ?? 2;
  const totalSlots = rows * cols;

  const initialSlots = useMemo<JigsawSlot[]>(() => {
    const prompts = config.prompts ?? [];
    return Array.from({ length: totalSlots }, (_, i) => ({
      id: `r${Math.floor(i / cols)}c${i % cols}`,
      row: Math.floor(i / cols),
      col: i % cols,
      prompt: prompts[i] ?? `第 ${i + 1} 格`,
    }));
  }, [config.prompts, totalSlots, cols]);

  const defaultState: JigsawState = { slots: initialSlots, isComplete: false };

  const { state, updateState } = useTeamPagePersistence<JigsawState>({
    gameId, sessionId, pageId, type: "jigsaw_puzzle", defaultState,
  });

  // 若 server 無資料，使用 initialSlots 初始化
  const slots = state.slots.length > 0 ? state.slots : initialSlots;

  const handleFillSlot = useCallback(async (slotId: string, text: string, color: string) => {
    const newSlots = slots.map((s: JigsawSlot) =>
      s.id === slotId ? { ...s, filledBy: myUserName, text, color } : s,
    );
    const isComplete = newSlots.every((s: JigsawSlot) => !!s.filledBy);
    await updateState({ slots: newSlots, isComplete });
  }, [slots, myUserName, updateState]);

  return (
    <JigsawPuzzle
      config={config}
      state={{ slots, isComplete: state.isComplete }}
      myUserId={myUserId}
      myUserName={myUserName}
      onFillSlot={handleFillSlot}
    />
  );
}
