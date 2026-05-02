// 🧩 JigsawPuzzlePage — GamePageRenderer 對應 pageType="jigsaw_puzzle"
//
// W4 D1 簡化版：本地 state，下輪 D2 接 useTeamJigsawSync hook（WS 同步隊友 fill）

import { useState, useMemo } from "react";
import JigsawPuzzle, { type JigsawPuzzleConfig } from "./JigsawPuzzle";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";

interface JigsawPuzzlePageProps {
  page: Page;
}

interface JigsawSlot {
  id: string;
  row: number;
  col: number;
  prompt: string;
  filledBy?: string;
  text?: string;
  color?: string;
}

interface JigsawState {
  slots: JigsawSlot[];
  isComplete: boolean;
}

export default function JigsawPuzzlePage({ page }: JigsawPuzzlePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: JigsawPuzzleConfig } | JigsawPuzzleConfig | null) ?? null;
  const config: JigsawPuzzleConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as JigsawPuzzleConfig | null)) ?? {};
  const rows = config.rows ?? 2;
  const cols = config.cols ?? 2;
  const totalSlots = rows * cols;

  // 初始 slots
  const initialSlots = useMemo<JigsawSlot[]>(() => {
    const prompts = config.prompts ?? [];
    return Array.from({ length: totalSlots }, (_, i) => ({
      id: `r${Math.floor(i / cols)}c${i % cols}`,
      row: Math.floor(i / cols),
      col: i % cols,
      prompt: prompts[i] ?? `第 ${i + 1} 格`,
    }));
  }, [config.prompts, totalSlots, cols]);

  const [state, setState] = useState<JigsawState>({
    slots: initialSlots,
    isComplete: false,
  });

  const handleFillSlot = (slotId: string, text: string, color: string) => {
    setState((prev) => {
      const newSlots = prev.slots.map((s) =>
        s.id === slotId ? { ...s, filledBy: myUserName, text, color } : s,
      );
      const isComplete = newSlots.every((s) => s.filledBy);
      return { slots: newSlots, isComplete };
    });
    // TODO W4 D2：透過 useTeamJigsawSync 廣播給隊友
  };

  return (
    <JigsawPuzzle
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onFillSlot={handleFillSlot}
    />
  );
}
