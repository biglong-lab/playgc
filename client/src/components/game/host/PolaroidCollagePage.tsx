// 📺 PolaroidCollagePage — GamePageRenderer 對應 pageType="host_polaroid_collage"

import { useCallback } from "react";
import PolaroidCollage, { type PolaroidCollageConfig } from "./PolaroidCollage";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";

interface PolaroidCollagePageProps {
  page: Page;
}

interface Polaroid {
  id: string;
  emoji: string;
  message: string;
  author: string;
  color: string;
  ts: number;
}

interface PolaroidCollageStateShape {
  polaroids: Polaroid[];
}

const MAX_POLAROIDS = 100;

export default function PolaroidCollagePage({ page }: PolaroidCollagePageProps) {
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "匿名";

  const rawConfig = (page.config as { config?: PolaroidCollageConfig } | PolaroidCollageConfig | null) ?? null;
  const config: PolaroidCollageConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PolaroidCollageConfig | null)) ?? {};

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: PolaroidCollageStateShape | null,
    ): PolaroidCollageStateShape | null => {
      if (pulseType !== "polaroid") return null;
      const p = payload as { emoji?: string; message?: string; color?: string };
      if (!p?.emoji || !p?.message) return null;

      const baseState: PolaroidCollageStateShape = currentState ?? { polaroids: [] };

      const newPolaroid: Polaroid = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        emoji: p.emoji,
        message: p.message.slice(0, 100),
        author: myUserName, // 從大螢幕端的 user 取（hack — 實際應該從 fromUserId 查 user table）
        color: p.color ?? "#fef3c7",
        ts: Date.now(),
      };

      // 保留最近 100 張（避免 state 爆炸）
      const polaroids = [...baseState.polaroids, newPolaroid].slice(-MAX_POLAROIDS);

      return { polaroids };
    },
    [myUserName],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<PolaroidCollageStateShape>({
    onPulse: handlePulse,
  });

  return (
    <PolaroidCollage
      config={config}
      hostMode={hostMode}
      state={state}
      myUserName={myUserName}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
